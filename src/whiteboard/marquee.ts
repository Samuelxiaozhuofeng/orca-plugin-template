import type { DbId } from "../orca.d.ts";
import {
  hitAreaIds,
  unionAreaIds,
  type WhiteboardArea,
} from "./areas";
import {
  normalizeRect,
  rectsIntersect,
  unionIds,
  type CardRect,
} from "./selection";
import type { WhiteboardCard } from "./data";

export const CLICK_THRESHOLD_PX = 3;

export type MarqueeCommit =
  | { kind: "click" }
  | { kind: "select"; ids: DbId[]; areaIds: string[] };

function screenRect(
  viewport: HTMLElement,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): CardRect {
  const bounds = viewport.getBoundingClientRect();
  return normalizeRect(x0 - bounds.left, y0 - bounds.top, x1 - bounds.left, y1 - bounds.top);
}

export function paintMarquee(el: HTMLElement | null, rect: CardRect | null): void {
  if (el == null) return;
  if (rect == null || (rect.w < 1 && rect.h < 1)) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.style.left = `${rect.x}px`;
  el.style.top = `${rect.y}px`;
  el.style.width = `${rect.w}px`;
  el.style.height = `${rect.h}px`;
}

export function setMarqueeHits(
  canvas: HTMLElement | null,
  cardIds: ReadonlySet<DbId>,
  areaIds?: ReadonlySet<string>,
): void {
  if (canvas == null) return;
  const cards = canvas.querySelectorAll<HTMLElement>(".owb-card");
  for (const card of cards) {
    const raw = card.dataset.blockId;
    const id = raw == null ? Number.NaN : Number(raw);
    card.classList.toggle("is-marquee-hit", Number.isFinite(id) && cardIds.has(id));
  }
  const areas = canvas.querySelectorAll<HTMLElement>(".owb-area");
  for (const area of areas) {
    const id = area.dataset.areaId;
    area.classList.toggle(
      "is-marquee-hit",
      id != null && areaIds != null && areaIds.has(id),
    );
  }
}

export function clearMarqueeHits(canvas: HTMLElement | null): void {
  if (canvas == null) return;
  canvas
    .querySelectorAll(".owb-card.is-marquee-hit, .owb-area.is-marquee-hit")
    .forEach((el) => el.classList.remove("is-marquee-hit"));
}

function hitIds(cards: readonly WhiteboardCard[], world: CardRect): DbId[] {
  return cards
    .filter((card) => rectsIntersect(card, world))
    .map((card) => card.blockId);
}

type TrackedGesture = {
  abort: () => void;
  untrack: () => void;
};

const marqueeBuckets = new WeakMap<object, Set<TrackedGesture>>();
const liveMarquees = new Set<TrackedGesture>();

function trackMarquee(root: object, onAbort: () => void): TrackedGesture {
  let open = true;
  let bucket = marqueeBuckets.get(root);
  if (bucket == null) {
    bucket = new Set();
    marqueeBuckets.set(root, bucket);
  }
  const entry: TrackedGesture = {
    abort() {
      if (!open) return;
      open = false;
      bucket!.delete(entry);
      liveMarquees.delete(entry);
      onAbort();
    },
    untrack() {
      if (!open) return;
      open = false;
      bucket!.delete(entry);
      liveMarquees.delete(entry);
    },
  };
  bucket.add(entry);
  liveMarquees.add(entry);
  return entry;
}

export function abortMarquees(root: object | null | undefined): void {
  if (root == null) return;
  const bucket = marqueeBuckets.get(root);
  if (bucket == null) return;
  for (const entry of [...bucket]) entry.abort();
}

/** Abort every in-flight marquee and drop window listeners. */
export function abortAllMarquees(): void {
  for (const entry of [...liveMarquees]) entry.abort();
}

export function startMarquee(opts: {
  startX: number;
  startY: number;
  additive: boolean;
  viewport: HTMLElement;
  canvas: HTMLElement;
  marqueeEl: HTMLElement;
  cards: readonly WhiteboardCard[];
  selected: readonly DbId[];
  areas: readonly WhiteboardArea[];
  selectedAreas: readonly string[];
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  onCommit: (result: MarqueeCommit) => void;
}): void {
  const startWorld = opts.pointerToWorld(opts.startX, opts.startY);
  let raf = 0;
  let finished = false;
  let last: { x: number; y: number } = { x: opts.startX, y: opts.startY };

  opts.viewport.classList.add("is-marqueeing");
  // `is-selected` is owned by React (Card.tsx / AreaLayer.tsx). Clearing it
  // imperatively here is only a preview of the pending selection, so remember
  // what we cleared and put it back when the gesture ends — otherwise an element
  // that stays selected keeps the class stripped, since React sees no change.
  const clearedSelection: HTMLElement[] = [];
  if (!opts.additive) {
    opts.canvas
      .querySelectorAll<HTMLElement>(".owb-card.is-selected, .owb-area.is-selected")
      .forEach((el) => {
        el.classList.remove("is-selected");
        clearedSelection.push(el);
      });
  }

  const paint = () => {
    raf = 0;
    if (finished) return;
    const screen = screenRect(opts.viewport, opts.startX, opts.startY, last.x, last.y);
    paintMarquee(opts.marqueeEl, screen);
    const now = opts.pointerToWorld(last.x, last.y);
    const world = normalizeRect(startWorld.x, startWorld.y, now.x, now.y);
    const cardHits = new Set(hitIds(opts.cards, world));
    const areaHits = new Set(hitAreaIds(opts.areas, world));
    setMarqueeHits(opts.canvas, cardHits, areaHits);
  };

  const detach = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    if (raf !== 0) window.cancelAnimationFrame(raf);
    raf = 0;
  };

  const finishVisual = () => {
    opts.viewport.classList.remove("is-marqueeing");
    paintMarquee(opts.marqueeEl, null);
    clearMarqueeHits(opts.canvas);
    for (const el of clearedSelection) el.classList.add("is-selected");
    clearedSelection.length = 0;
  };

  const onMove = (event: MouseEvent) => {
    if (finished) return;
    last = { x: event.clientX, y: event.clientY };
    if (raf === 0) raf = window.requestAnimationFrame(paint);
  };

  const onUp = (event: MouseEvent) => {
    if (finished) return;
    finished = true;
    tracked.untrack();
    detach();
    finishVisual();

    const dx = event.clientX - opts.startX;
    const dy = event.clientY - opts.startY;
    if (dx * dx + dy * dy < CLICK_THRESHOLD_PX * CLICK_THRESHOLD_PX) {
      opts.onCommit({ kind: "click" });
      return;
    }
    const now = opts.pointerToWorld(event.clientX, event.clientY);
    const world = normalizeRect(startWorld.x, startWorld.y, now.x, now.y);
    const cardHits = hitIds(opts.cards, world);
    const areaHits = hitAreaIds(opts.areas, world);
    opts.onCommit({
      kind: "select",
      ids: opts.additive ? unionIds(opts.selected, cardHits) : cardHits,
      areaIds: opts.additive
        ? unionAreaIds(opts.selectedAreas, areaHits)
        : areaHits,
    });
  };

  const tracked = trackMarquee(opts.canvas, () => {
    if (finished) return;
    finished = true;
    detach();
    finishVisual();
  });

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

