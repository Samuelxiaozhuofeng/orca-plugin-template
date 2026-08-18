import type { DbId } from "../orca.d.ts";
import {
  cursorBox,
  curveForBoxes,
  hitCardAt,
  type CardBox,
  type Point,
} from "./edgeGeometry";
import { edgeDedupeKey, type EdgeBend, type Side } from "./edges";
import { resolveRowAnchorBox } from "./edgeRowBoxes";

export type BoxedCard = { blockId: DbId } & CardBox;

export type EdgeEls = {
  visible: SVGPathElement | null;
  hit: SVGPathElement | null;
  label: HTMLElement | null;
  handleFrom: SVGElement | null;
  handleTo: SVGElement | null;
  handleMid: SVGElement | null;
  handleCtrlFrom: SVGElement | null;
  handleCtrlTo: SVGElement | null;
  tangentFrom: SVGElement | null;
  tangentTo: SVGElement | null;
};

function setCircle(el: SVGElement | null, p: Point): void {
  if (el == null) return;
  el.setAttribute("cx", String(p.x));
  el.setAttribute("cy", String(p.y));
}

function setLine(el: SVGElement | null, a: Point, b: Point): void {
  if (el == null) return;
  el.setAttribute("x1", String(a.x));
  el.setAttribute("y1", String(a.y));
  el.setAttribute("x2", String(b.x));
  el.setAttribute("y2", String(b.y));
}

export function setGhostPath(el: SVGPathElement | null, d: string): void {
  if (el == null) return;
  if (d === "") {
    el.setAttribute("d", "");
    el.setAttribute("visibility", "hidden");
    return;
  }
  el.setAttribute("visibility", "visible");
  el.setAttribute("d", d);
}

export function paintCurveDom(els: EdgeEls, curve: ReturnType<typeof curveForBoxes>): void {
  if (els.visible != null) els.visible.setAttribute("d", curve.d);
  if (els.hit != null) els.hit.setAttribute("d", curve.d);
  if (els.label != null) {
    els.label.style.left = `${curve.label.x}px`;
    els.label.style.top = `${curve.label.y}px`;
  }
  setCircle(els.handleFrom, curve.p0);
  setCircle(els.handleTo, curve.p3);
  setCircle(els.handleMid, curve.label);
  setCircle(els.handleCtrlFrom, curve.p1);
  setCircle(els.handleCtrlTo, curve.p2);
  setLine(els.tangentFrom, curve.p0, curve.p1);
  setLine(els.tangentTo, curve.p3, curve.p2);
}

export function paintEdgesForBoxes(
  edges: ReadonlyArray<{
    id: string;
    from: DbId;
    to: DbId;
    fromBlock?: DbId;
    fromSide?: Side;
    toSide?: Side;
    bend?: EdgeBend;
  }>,
  boxes: Map<DbId, CardBox>,
  getEls: (id: string) => EdgeEls | undefined,
  getRowBox?: (cardId: DbId, rowId: DbId, cardBox: CardBox) => CardBox | null,
): void {
  for (const edge of edges) {
    const fromCardBox = boxes.get(edge.from);
    const to = boxes.get(edge.to);
    if (fromCardBox == null || to == null) continue;
    const els = getEls(edge.id);
    if (els == null) continue;
    const rowBox =
      edge.fromBlock != null && getRowBox != null
        ? getRowBox(edge.from, edge.fromBlock, fromCardBox)
        : null;
    const source = resolveRowAnchorBox(fromCardBox, rowBox, to, edge.fromSide);
    paintCurveDom(
      els,
      curveForBoxes(source.box, to, source.side, edge.toSide, edge.bend),
    );
  }
}

function clearTargets(canvas: HTMLElement): void {
  canvas
    .querySelectorAll(".owb-card.is-edge-target")
    .forEach((el) => el.classList.remove("is-edge-target"));
}

export function setEdgeTarget(canvas: HTMLElement, id: DbId | null): void {
  clearTargets(canvas);
  if (id == null) return;
  canvas
    .querySelector(`[data-block-id="${id}"]`)
    ?.classList.add("is-edge-target");
}

export type DrawDropEmpty = {
  clientX: number;
  clientY: number;
  world: { x: number; y: number };
  fromId: DbId;
  fromBlock?: DbId;
  fromSide?: Side;
};

type TrackedGesture = {
  abort: () => void;
  untrack: () => void;
};

const edgeGestureBuckets = new WeakMap<object, Set<TrackedGesture>>();
const liveEdgeGestures = new Set<TrackedGesture>();

export function trackEdgeGesture(root: object, onAbort: () => void): TrackedGesture {
  let open = true;
  let bucket = edgeGestureBuckets.get(root);
  if (bucket == null) {
    bucket = new Set();
    edgeGestureBuckets.set(root, bucket);
  }
  const entry: TrackedGesture = {
    abort() {
      if (!open) return;
      open = false;
      bucket!.delete(entry);
      liveEdgeGestures.delete(entry);
      onAbort();
    },
    untrack() {
      if (!open) return;
      open = false;
      bucket!.delete(entry);
      liveEdgeGestures.delete(entry);
    },
  };
  bucket.add(entry);
  liveEdgeGestures.add(entry);
  return entry;
}

export function abortEdgeGestures(root: object | null | undefined): void {
  if (root == null) return;
  const bucket = edgeGestureBuckets.get(root);
  if (bucket == null) return;
  for (const entry of [...bucket]) entry.abort();
}

export function abortAllEdgeGestures(): void {
  for (const entry of [...liveEdgeGestures]) entry.abort();
}

export function startDrawEdge(opts: {
  fromId: DbId;
  fromBlock?: DbId;
  fromSide?: Side;
  fromCardBox: CardBox;
  fromRowBox?: CardBox | null;
  cards: () => readonly BoxedCard[];
  canvas: HTMLElement;
  ghost: SVGPathElement;
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  occupiedPairs: () => ReadonlySet<string>;
  onComplete: (toId: DbId, fromSide?: Side) => void;
  onCancel: () => void;
  onDropEmpty: (drop: DrawDropEmpty) => void;
  finishOn?: "mouseup" | "mousedown";
}): { dismiss: () => void } {
  const finishOn = opts.finishOn ?? "mouseup";
  let live = true;
  let ignoreFirstUp = finishOn === "mousedown";
  opts.canvas.classList.add("is-drawing-edge");
  setGhostPath(opts.ghost, "");

  const detach = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    window.removeEventListener("mousedown", onDown, true);
    window.removeEventListener("keydown", onKey, true);
  };

  const cleanup = (clearGhost: boolean) => {
    if (live) {
      live = false;
      tracked.untrack();
      detach();
      clearTargets(opts.canvas);
      opts.canvas.classList.remove("is-drawing-edge");
      opts.canvas
        .querySelectorAll(
          ".owb-card-tb-btn.is-connecting, .owb-row-connect-btn.is-connecting",
        )
        .forEach((el) => el.classList.remove("is-connecting"));
    }
    if (clearGhost) setGhostPath(opts.ghost, "");
  };

  const tracked = trackEdgeGesture(opts.canvas, () => cleanup(true));

  const targetOccupied = (targetId: DbId, occupied: ReadonlySet<string>) => {
    const key = edgeDedupeKey({
      from: opts.fromId,
      to: targetId,
      fromBlock: opts.fromBlock,
    });
    return occupied.has(key);
  };

  const paint = (clientX: number, clientY: number) => {
    if (!live) return;
    const world = opts.pointerToWorld(clientX, clientY);
    const cards = opts.cards();
    const rawHit = hitCardAt(cards, world);
    const occupied = opts.occupiedPairs();
    const hit =
      rawHit != null &&
      rawHit !== opts.fromId &&
      !targetOccupied(rawHit, occupied)
        ? rawHit
        : null;
    setEdgeTarget(opts.canvas, hit);
    const dest =
      hit != null
        ? cards.find((card) => card.blockId === hit)
        : cursorBox(world);
    if (dest == null) return;
    const source = resolveRowAnchorBox(
      opts.fromCardBox,
      opts.fromRowBox,
      dest,
      opts.fromSide,
    );
    const curve = curveForBoxes(source.box, dest, source.side, undefined);
    setGhostPath(opts.ghost, curve.d);
  };

  const finish = (event: MouseEvent) => {
    if (!live) return;
    const world = opts.pointerToWorld(event.clientX, event.clientY);
    const cards = opts.cards();
    const rawHit = hitCardAt(cards, world);
    const occupied = opts.occupiedPairs();
    const hit =
      rawHit != null &&
      rawHit !== opts.fromId &&
      !targetOccupied(rawHit, occupied)
        ? rawHit
        : null;
    if (hit == null) {
      // Released over a card we cannot connect to (itself, or an already
      // connected pair): just cancel. Offering "new card here" would drop
      // the new card on top of the card under the cursor.
      if (rawHit != null) {
        cleanup(true);
        opts.onCancel();
        return;
      }
      cleanup(false);
      opts.onDropEmpty({
        clientX: event.clientX,
        clientY: event.clientY,
        world,
        fromId: opts.fromId,
        fromBlock: opts.fromBlock,
        fromSide: opts.fromSide,
      });
      return;
    }
    cleanup(true);
    opts.onComplete(hit, opts.fromSide);
  };

  const onMove = (event: MouseEvent) => {
    if (!live) return;
    paint(event.clientX, event.clientY);
  };

  const onUp = (event: MouseEvent) => {
    if (!live) return;
    if (finishOn === "mousedown") {
      if (ignoreFirstUp) ignoreFirstUp = false;
      return;
    }
    finish(event);
  };

  const onDown = (event: MouseEvent) => {
    if (!live || finishOn !== "mousedown") return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    finish(event);
  };

  const onKey = (event: KeyboardEvent) => {
    if (!live) return;
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    cleanup(true);
    opts.onCancel();
  };

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  if (finishOn === "mousedown") {
    window.addEventListener("mousedown", onDown, true);
  }
  window.addEventListener("keydown", onKey, true);
  return { dismiss: () => cleanup(true) };
}
