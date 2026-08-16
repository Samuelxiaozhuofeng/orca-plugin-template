import type { DbId } from "../orca.d.ts";
import {
  bendAfterCtrlDrag,
  bendAfterMidDrag,
  nearestValidAnchor,
} from "./edgeBend";
import {
  cursorBox,
  curveForBoxes,
  type CardBox,
  type EdgeCurve,
} from "./edgeGeometry";
import {
  paintCurveDom,
  setEdgeTarget,
  trackEdgeGesture,
  type BoxedCard,
  type EdgeEls,
} from "./edgeGestures";
import type { EdgeBend, WhiteboardEdge } from "./edges";
import { CLICK_THRESHOLD_PX } from "./marquee";

export function paintSnapDot(
  el: SVGCircleElement | null,
  at: { x: number; y: number } | null,
): void {
  if (el == null) return;
  if (at == null) {
    el.setAttribute("visibility", "hidden");
    return;
  }
  el.setAttribute("visibility", "visible");
  el.setAttribute("cx", String(at.x));
  el.setAttribute("cy", String(at.y));
}

function boxesFromCards(cards: readonly BoxedCard[]): Map<DbId, CardBox> {
  const map = new Map<DbId, CardBox>();
  for (const card of cards) map.set(card.blockId, card);
  return map;
}

function curveOfEdge(
  edge: WhiteboardEdge,
  boxes: Map<DbId, CardBox>,
): { from: CardBox; to: CardBox; curve: EdgeCurve } | null {
  const from = boxes.get(edge.from);
  const to = boxes.get(edge.to);
  if (from == null || to == null) return null;
  return {
    from,
    to,
    curve: curveForBoxes(from, to, edge.fromSide, edge.toSide, edge.bend),
  };
}

function replaceEdge(
  edges: readonly WhiteboardEdge[],
  id: string,
  next: WhiteboardEdge,
): WhiteboardEdge[] {
  return edges.map((item) => (item.id === id ? next : item));
}

function cardBox(
  cards: readonly BoxedCard[],
  id: DbId,
): CardBox | null {
  const card = cards.find((item) => item.blockId === id);
  return card == null ? null : card;
}

const liveHandleGestures = new Set<{ abort: () => void }>();

/** Abort every in-flight edge-handle drag and drop window listeners. */
export function abortAllEdgeHandleGestures(): void {
  for (const entry of [...liveHandleGestures]) entry.abort();
}

type HandleGestureOpts = {
  edgeId: string;
  canvas: HTMLElement;
  startClientX: number;
  startClientY: number;
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  getEdges: () => readonly WhiteboardEdge[];
  getCards: () => readonly BoxedCard[];
  getEls: (id: string) => EdgeEls | undefined;
  onCommit: (next: WhiteboardEdge[]) => void;
};

function attachWindowDrag(opts: {
  canvas: HTMLElement;
  className: string;
  onMove: (event: MouseEvent) => void;
  onUp: (event: MouseEvent) => void;
  onCancel: () => void;
}): { finish: (after?: () => void) => void } {
  let live = true;
  const detach = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    window.removeEventListener("keydown", onKey, true);
  };
  const finish = (after?: () => void) => {
    if (!live) return;
    live = false;
    tracked.untrack();
    detach();
    opts.canvas.classList.remove(opts.className);
    after?.();
  };
  const onMove = (event: MouseEvent) => {
    if (live) opts.onMove(event);
  };
  const onUp = (event: MouseEvent) => {
    if (live) opts.onUp(event);
  };
  const onKey = (event: KeyboardEvent) => {
    if (!live || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    opts.onCancel();
  };
  opts.canvas.classList.add(opts.className);
  const tracked = trackEdgeGesture(opts.canvas, () => opts.onCancel());
  liveHandleGestures.add(tracked);
  const finishAndForget = (after?: () => void) => {
    liveHandleGestures.delete(tracked);
    finish(after);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  window.addEventListener("keydown", onKey, true);
  return { finish: finishAndForget };
}

function passedClick(
  moved: boolean,
  startX: number,
  startY: number,
  clientX: number,
  clientY: number,
): boolean {
  if (moved) return true;
  return Math.hypot(clientX - startX, clientY - startY) >= CLICK_THRESHOLD_PX;
}

function restoreEdgePaint(opts: HandleGestureOpts): void {
  const edge = opts.getEdges().find((item) => item.id === opts.edgeId);
  const els = opts.getEls(opts.edgeId);
  if (edge == null || els == null) return;
  const now = curveOfEdge(edge, boxesFromCards(opts.getCards()));
  if (now == null) return;
  paintCurveDom(els, now.curve);
}

export function startBendHandleDrag(
  opts: HandleGestureOpts & { which: "mid" | "from" | "to" },
): void {
  const edge = opts.getEdges().find((item) => item.id === opts.edgeId);
  if (edge == null) return;
  const start = curveOfEdge(edge, boxesFromCards(opts.getCards()));
  if (start == null) return;

  let moved = false;

  const bendAt = (clientX: number, clientY: number): EdgeBend => {
    const world = opts.pointerToWorld(clientX, clientY);
    return opts.which === "mid"
      ? bendAfterMidDrag(start.curve, world)
      : bendAfterCtrlDrag(start.curve, opts.which, world);
  };

  const paintBend = (bend: EdgeBend) => {
    const els = opts.getEls(opts.edgeId);
    if (els == null) return;
    paintCurveDom(
      els,
      curveForBoxes(
        start.from,
        start.to,
        start.curve.fromSide,
        start.curve.toSide,
        bend,
      ),
    );
  };

  const session = attachWindowDrag({
    canvas: opts.canvas,
    className: "is-editing-edge",
    onMove: (event) => {
      if (
        !passedClick(
          moved,
          opts.startClientX,
          opts.startClientY,
          event.clientX,
          event.clientY,
        )
      ) {
        return;
      }
      moved = true;
      paintBend(bendAt(event.clientX, event.clientY));
    },
    onUp: (event) => {
      if (!moved) {
        session.finish();
        return;
      }
      const bend = bendAt(event.clientX, event.clientY);
      session.finish();
      const current = opts.getEdges();
      const item = current.find((entry) => entry.id === opts.edgeId);
      if (item == null) return;
      opts.onCommit(
        replaceEdge(current, opts.edgeId, {
          ...item,
          fromSide: start.curve.fromSide,
          toSide: start.curve.toSide,
          bend,
        }),
      );
    },
    onCancel: () => {
      session.finish(() => restoreEdgePaint(opts));
    },
  });
}

export function startEndpointHandleDrag(
  opts: HandleGestureOpts & {
    which: "from" | "to";
    snapEl: SVGCircleElement | null;
  },
): void {
  const edge = opts.getEdges().find((item) => item.id === opts.edgeId);
  if (edge == null) return;
  const start = curveOfEdge(edge, boxesFromCards(opts.getCards()));
  if (start == null) return;

  let moved = false;

  const clearSnap = () => {
    paintSnapDot(opts.snapEl, null);
    setEdgeTarget(opts.canvas, null);
  };

  const paintLive = (clientX: number, clientY: number) => {
    const world = opts.pointerToWorld(clientX, clientY);
    const cards = opts.getCards();
    const edges = opts.getEdges();
    const live = edges.find((item) => item.id === opts.edgeId) ?? edge;
    const snap = nearestValidAnchor(world, cards, {
      edgeId: opts.edgeId,
      moving: opts.which,
      edge: live,
      edges,
    });
    paintSnapDot(opts.snapEl, snap?.point ?? null);
    setEdgeTarget(opts.canvas, snap?.cardId ?? null);
    const els = opts.getEls(opts.edgeId);
    if (els == null) return;
    const fromBox =
      opts.which === "from"
        ? snap != null
          ? cardBox(cards, snap.cardId) ?? cursorBox(world)
          : cursorBox(world)
        : start.from;
    const toBox =
      opts.which === "to"
        ? snap != null
          ? cardBox(cards, snap.cardId) ?? cursorBox(world)
          : cursorBox(world)
        : start.to;
    const fromSide =
      opts.which === "from" ? snap?.side : start.curve.fromSide;
    const toSide = opts.which === "to" ? snap?.side : start.curve.toSide;
    paintCurveDom(
      els,
      curveForBoxes(fromBox, toBox, fromSide, toSide, live.bend),
    );
  };

  const session = attachWindowDrag({
    canvas: opts.canvas,
    className: "is-rebinding-edge",
    onMove: (event) => {
      if (
        !passedClick(
          moved,
          opts.startClientX,
          opts.startClientY,
          event.clientX,
          event.clientY,
        )
      ) {
        return;
      }
      moved = true;
      paintLive(event.clientX, event.clientY);
    },
    onUp: (event) => {
      if (!moved) {
        session.finish(clearSnap);
        return;
      }
      const world = opts.pointerToWorld(event.clientX, event.clientY);
      const cards = opts.getCards();
      const edges = opts.getEdges();
      const live = edges.find((item) => item.id === opts.edgeId) ?? edge;
      const snap = nearestValidAnchor(world, cards, {
        edgeId: opts.edgeId,
        moving: opts.which,
        edge: live,
        edges,
      });
      if (snap == null) {
        session.finish(() => {
          clearSnap();
          restoreEdgePaint(opts);
        });
        return;
      }
      session.finish(clearSnap);
      const next: WhiteboardEdge =
        opts.which === "from"
          ? {
              ...live,
              from: snap.cardId,
              fromSide: snap.side,
              toSide: live.toSide ?? start.curve.toSide,
            }
          : {
              ...live,
              to: snap.cardId,
              toSide: snap.side,
              fromSide: live.fromSide ?? start.curve.fromSide,
            };
      opts.onCommit(replaceEdge(edges, opts.edgeId, next));
    },
    onCancel: () => {
      session.finish(() => {
        clearSnap();
        restoreEdgePaint(opts);
      });
    },
  });
}
