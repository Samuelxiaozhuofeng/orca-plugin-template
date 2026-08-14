import type { DbId } from "../orca.d.ts";
import {
  cursorBox,
  curveForBoxes,
  hitCardAt,
  type CardBox,
} from "./edgeGeometry";
import { pairKey, type Side } from "./edges";

export type BoxedCard = { blockId: DbId } & CardBox;

export type EdgeEls = {
  visible: SVGPathElement | null;
  hit: SVGPathElement | null;
  label: HTMLElement | null;
  handleFrom: SVGElement | null;
  handleTo: SVGElement | null;
};

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
  if (els.handleFrom != null) {
    els.handleFrom.setAttribute("cx", String(curve.p0.x));
    els.handleFrom.setAttribute("cy", String(curve.p0.y));
  }
  if (els.handleTo != null) {
    els.handleTo.setAttribute("cx", String(curve.p3.x));
    els.handleTo.setAttribute("cy", String(curve.p3.y));
  }
}

export function paintEdgesForBoxes(
  edges: ReadonlyArray<{
    id: string;
    from: DbId;
    to: DbId;
    fromSide?: Side;
    toSide?: Side;
  }>,
  boxes: Map<DbId, CardBox>,
  getEls: (id: string) => EdgeEls | undefined,
): void {
  for (const edge of edges) {
    const from = boxes.get(edge.from);
    const to = boxes.get(edge.to);
    if (from == null || to == null) continue;
    const els = getEls(edge.id);
    if (els == null) continue;
    paintCurveDom(els, curveForBoxes(from, to, edge.fromSide, edge.toSide));
  }
}

function clearTargets(canvas: HTMLElement): void {
  canvas
    .querySelectorAll(".owb-card.is-edge-target")
    .forEach((el) => el.classList.remove("is-edge-target"));
}

function markTarget(canvas: HTMLElement, id: DbId | null): void {
  clearTargets(canvas);
  if (id == null) return;
  canvas
    .querySelector(`[data-block-id="${id}"]`)
    ?.classList.add("is-edge-target");
}

export function startDrawEdge(opts: {
  fromId: DbId;
  fromSide: Side;
  fromBox: CardBox;
  cards: () => readonly BoxedCard[];
  canvas: HTMLElement;
  ghost: SVGPathElement;
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  occupiedPairs: () => ReadonlySet<string>;
  onComplete: (toId: DbId, fromSide: Side) => void;
  onCancel: () => void;
}): void {
  let finished = false;
  opts.canvas.classList.add("is-drawing-edge");
  setGhostPath(opts.ghost, "");

  const finish = () => {
    if (finished) return;
    finished = true;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    window.removeEventListener("keydown", onKey, true);
    clearTargets(opts.canvas);
    setGhostPath(opts.ghost, "");
    opts.canvas.classList.remove("is-drawing-edge");
  };

  const paint = (clientX: number, clientY: number) => {
    const world = opts.pointerToWorld(clientX, clientY);
    const cards = opts.cards();
    const rawHit = hitCardAt(cards, world);
    const occupied = opts.occupiedPairs();
    const hit =
      rawHit != null &&
      rawHit !== opts.fromId &&
      !occupied.has(pairKey(opts.fromId, rawHit))
        ? rawHit
        : null;
    markTarget(opts.canvas, hit);
    const dest =
      hit != null
        ? cards.find((card) => card.blockId === hit)
        : cursorBox(world);
    if (dest == null) return;
    const curve = curveForBoxes(opts.fromBox, dest, opts.fromSide, undefined);
    setGhostPath(opts.ghost, curve.d);
  };

  const onMove = (event: MouseEvent) => {
    paint(event.clientX, event.clientY);
  };

  const onUp = (event: MouseEvent) => {
    const world = opts.pointerToWorld(event.clientX, event.clientY);
    const cards = opts.cards();
    const rawHit = hitCardAt(cards, world);
    const occupied = opts.occupiedPairs();
    const hit =
      rawHit != null &&
      rawHit !== opts.fromId &&
      !occupied.has(pairKey(opts.fromId, rawHit))
        ? rawHit
        : null;
    finish();
    if (hit == null) {
      opts.onCancel();
      return;
    }
    opts.onComplete(hit, opts.fromSide);
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    finish();
    opts.onCancel();
  };

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  window.addEventListener("keydown", onKey, true);
}
