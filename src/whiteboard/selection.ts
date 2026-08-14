import type { DbId } from "../orca.d.ts";
import {
  GRID_GAP,
  defaultGridColumns,
  type WhiteboardCard,
} from "./data";

export type CardRect = { x: number; y: number; w: number; h: number };

export type ArrangeAction =
  | "alignLeft"
  | "alignCenterX"
  | "alignRight"
  | "alignTop"
  | "alignCenterY"
  | "alignBottom"
  | "distributeX"
  | "distributeY"
  | "grid";

export type CardPosPatch = { blockId: DbId; x: number; y: number };

export function toggleId(ids: readonly DbId[], id: DbId): DbId[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

export function unionIds(left: readonly DbId[], right: readonly DbId[]): DbId[] {
  const set = new Set(left);
  for (const id of right) set.add(id);
  return [...set];
}

export function rectsIntersect(a: CardRect, b: CardRect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

export function normalizeRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): CardRect {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.abs(x1 - x0),
    h: Math.abs(y1 - y0),
  };
}

export function unionRects(rects: readonly CardRect[]): CardRect | null {
  if (rects.length === 0) return null;
  let left = rects[0].x;
  let top = rects[0].y;
  let right = rects[0].x + rects[0].w;
  let bottom = rects[0].y + rects[0].h;
  for (let i = 1; i < rects.length; i++) {
    const box = rects[i];
    left = Math.min(left, box.x);
    top = Math.min(top, box.y);
    right = Math.max(right, box.x + box.w);
    bottom = Math.max(bottom, box.y + box.h);
  }
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function selectedCards(
  cards: readonly WhiteboardCard[],
  ids: ReadonlySet<DbId>,
): WhiteboardCard[] {
  return cards.filter((card) => ids.has(card.blockId));
}

function posPatches(
  cards: readonly WhiteboardCard[],
  nextPos: Map<DbId, { x: number; y: number }>,
): CardPosPatch[] {
  const out: CardPosPatch[] = [];
  for (const card of cards) {
    const next = nextPos.get(card.blockId);
    if (next == null) continue;
    if (next.x === card.x && next.y === card.y) continue;
    out.push({ blockId: card.blockId, x: next.x, y: next.y });
  }
  return out;
}

function alignAxis(
  picked: readonly WhiteboardCard[],
  axis: "x" | "y",
  pick: (card: WhiteboardCard) => number,
): Map<DbId, { x: number; y: number }> {
  const target = pick(picked[0]);
  const next = new Map<DbId, { x: number; y: number }>();
  for (const card of picked) {
    next.set(card.blockId, {
      x: axis === "x" ? target : card.x,
      y: axis === "y" ? target : card.y,
    });
  }
  return next;
}

function distribute(
  picked: readonly WhiteboardCard[],
  axis: "x" | "y",
): Map<DbId, { x: number; y: number }> {
  const next = new Map<DbId, { x: number; y: number }>();
  if (picked.length < 3) return next;
  const size = (card: WhiteboardCard) => (axis === "x" ? card.w : card.h);
  const start = (card: WhiteboardCard) => (axis === "x" ? card.x : card.y);
  const sorted = [...picked].sort((a, b) => start(a) - start(b));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const spanStart = start(first);
  const spanEnd = start(last) + size(last);
  const totalSize = sorted.reduce((sum, card) => sum + size(card), 0);
  const gap = (spanEnd - spanStart - totalSize) / (sorted.length - 1);
  let cursor = spanStart;
  for (const card of sorted) {
    next.set(card.blockId, {
      x: axis === "x" ? cursor : card.x,
      y: axis === "y" ? cursor : card.y,
    });
    cursor += size(card) + gap;
  }
  return next;
}

function tidyGrid(
  picked: readonly WhiteboardCard[],
  columns: number,
  gap: number,
): Map<DbId, { x: number; y: number }> {
  const next = new Map<DbId, { x: number; y: number }>();
  if (picked.length === 0) return next;
  const cols = Math.max(1, Math.min(columns, picked.length));
  const cellW = Math.max(...picked.map((card) => card.w));
  const cellH = Math.max(...picked.map((card) => card.h));
  const bounds = unionRects(picked);
  const originX = bounds?.x ?? picked[0].x;
  const originY = bounds?.y ?? picked[0].y;
  picked.forEach((card, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    next.set(card.blockId, {
      x: originX + col * (cellW + gap),
      y: originY + row * (cellH + gap),
    });
  });
  return next;
}

export function arrangeCards(
  action: ArrangeAction,
  cards: readonly WhiteboardCard[],
  selectedIds: ReadonlySet<DbId>,
  viewportWidth: number,
): CardPosPatch[] {
  const picked = selectedCards(cards, selectedIds);
  if (picked.length < 2) return [];

  let next: Map<DbId, { x: number; y: number }>;
  if (action === "alignLeft") {
    const left = Math.min(...picked.map((card) => card.x));
    next = alignAxis(picked, "x", () => left);
  } else if (action === "alignCenterX") {
    const bounds = unionRects(picked);
    if (bounds == null) return [];
    const cx = bounds.x + bounds.w / 2;
    next = new Map(
      picked.map((card) => [
        card.blockId,
        { x: cx - card.w / 2, y: card.y },
      ]),
    );
  } else if (action === "alignRight") {
    const right = Math.max(...picked.map((card) => card.x + card.w));
    next = new Map(
      picked.map((card) => [card.blockId, { x: right - card.w, y: card.y }]),
    );
  } else if (action === "alignTop") {
    const top = Math.min(...picked.map((card) => card.y));
    next = alignAxis(picked, "y", () => top);
  } else if (action === "alignCenterY") {
    const bounds = unionRects(picked);
    if (bounds == null) return [];
    const cy = bounds.y + bounds.h / 2;
    next = new Map(
      picked.map((card) => [
        card.blockId,
        { x: card.x, y: cy - card.h / 2 },
      ]),
    );
  } else if (action === "alignBottom") {
    const bottom = Math.max(...picked.map((card) => card.y + card.h));
    next = new Map(
      picked.map((card) => [card.blockId, { x: card.x, y: bottom - card.h }]),
    );
  } else if (action === "distributeX") {
    next = distribute(picked, "x");
  } else if (action === "distributeY") {
    next = distribute(picked, "y");
  } else {
    next = tidyGrid(picked, defaultGridColumns(viewportWidth), GRID_GAP);
  }
  return posPatches(cards, next);
}
