import type { DbId } from "../orca.d.ts";
import type { WhiteboardCard } from "./cards.ts";
import { sanitizeEdges, type WhiteboardEdge } from "./edges.ts";
import { CARD_HEIGHT, CARD_WIDTH, GRID_ORIGIN } from "./layout.ts";

export type CollectIntoBoardPlan = {
  /** Selected cards, translated so their bounding-box top-left sits at GRID_ORIGIN. */
  movedCards: WhiteboardCard[];
  /** Edges whose both ends were selected. */
  movedEdges: WhiteboardEdge[];
  /** Cards that stay on board A, plus the new sub-board card. */
  leftoverCards: WhiteboardCard[];
  /**
   * Edges that stay on board A: untouched pairs plus remapped cross-border
   * ones, after `sanitizeEdges` (self-loops and duplicate pairs dropped).
   */
  leftoverEdges: WhiteboardEdge[];
  /** Default-sized card for the new sub-board, centered on the selection box. */
  subBoardCard: WhiteboardCard;
};

export type DropOntoBoardPlan = {
  movedCards: WhiteboardCard[];
  movedEdges: WhiteboardEdge[];
  leftoverCards: WhiteboardCard[];
  leftoverEdges: WhiteboardEdge[];
  targetBoardId: DbId;
};

function unionBox(
  cards: ReadonlyArray<{ x: number; y: number; w: number; h: number }>,
): { x: number; y: number; w: number; h: number } | null {
  if (cards.length === 0) return null;
  let left = cards[0].x;
  let top = cards[0].y;
  let right = cards[0].x + cards[0].w;
  let bottom = cards[0].y + cards[0].h;
  for (let i = 1; i < cards.length; i++) {
    const box = cards[i];
    left = Math.min(left, box.x);
    top = Math.min(top, box.y);
    right = Math.max(right, box.x + box.w);
    bottom = Math.max(bottom, box.y + box.h);
  }
  return { x: left, y: top, w: right - left, h: bottom - top };
}

function translateCard(card: WhiteboardCard, dx: number, dy: number): WhiteboardCard {
  return { ...card, x: card.x + dx, y: card.y + dy };
}

/** Shift a group so its bounding-box top-left sits at `origin`. Relative offsets stay. */
export function translateGroupToOrigin(
  cards: readonly WhiteboardCard[],
  originX: number,
  originY: number,
): WhiteboardCard[] {
  const bounds = unionBox(cards);
  if (bounds == null) return cards.map((card) => ({ ...card }));
  const dx = originX - bounds.x;
  const dy = originY - bounds.y;
  return cards.map((card) => translateCard(card, dx, dy));
}

/**
 * Bend is stored as along/across of the chord (see `edgeBend.ts`), not world
 * pixels. A uniform translation of both cards leaves those ratios valid, so
 * moved edges keep `bend`. Remapped edges change an endpoint — drop bend.
 */
function remapCrossEdge(
  edge: WhiteboardEdge,
  selected: ReadonlySet<DbId>,
  subBoardId: DbId,
): WhiteboardEdge {
  const next: WhiteboardEdge = {
    id: edge.id,
    from: selected.has(edge.from) ? subBoardId : edge.from,
    to: selected.has(edge.to) ? subBoardId : edge.to,
    arrow: edge.arrow,
  };
  if (edge.label != null) next.label = edge.label;
  if (edge.fromSide != null) next.fromSide = edge.fromSide;
  if (edge.toSide != null) next.toSide = edge.toSide;
  if (edge.color != null) next.color = edge.color;
  if (edge.style != null) next.style = edge.style;
  if (edge.linked === true) next.linked = true;
  return next;
}

function splitEdgesForMove(
  edges: readonly WhiteboardEdge[],
  movingIds: ReadonlySet<DbId>,
  remapTo: DbId,
): { movedEdges: WhiteboardEdge[]; stayEdges: WhiteboardEdge[] } {
  const movedEdges: WhiteboardEdge[] = [];
  const stayEdges: WhiteboardEdge[] = [];
  for (const edge of edges) {
    const fromOn = movingIds.has(edge.from);
    const toOn = movingIds.has(edge.to);
    if (fromOn && toOn) {
      movedEdges.push({ ...edge });
    } else if (fromOn || toOn) {
      const remapped = remapCrossEdge(edge, movingIds, remapTo);
      if (remapped.from === remapped.to) continue;
      stayEdges.push(remapped);
    } else {
      stayEdges.push({ ...edge });
    }
  }
  return { movedEdges, stayEdges };
}

/**
 * Plan for collecting selected cards into a new sub-board.
 * Returns null when fewer than two selected cards sit on this board.
 */
export function planCollectIntoBoard(
  cards: readonly WhiteboardCard[],
  edges: readonly WhiteboardEdge[],
  selectedIds: ReadonlySet<DbId>,
  subBoardId: DbId,
): CollectIntoBoardPlan | null {
  const picked = cards.filter((card) => selectedIds.has(card.blockId));
  if (picked.length < 2) return null;

  const bounds = unionBox(picked);
  if (bounds == null) return null;

  const movedCards = translateGroupToOrigin(picked, GRID_ORIGIN, GRID_ORIGIN);
  const leftoverCards = cards.filter((card) => !selectedIds.has(card.blockId));
  const { movedEdges, stayEdges } = splitEdgesForMove(
    edges,
    selectedIds,
    subBoardId,
  );

  const subBoardCard: WhiteboardCard = {
    blockId: subBoardId,
    kind: "block",
    x: bounds.x + bounds.w / 2 - CARD_WIDTH / 2,
    y: bounds.y + bounds.h / 2 - CARD_HEIGHT / 2,
    w: CARD_WIDTH,
    h: CARD_HEIGHT,
  };

  return {
    movedCards,
    movedEdges,
    leftoverCards: [...leftoverCards, subBoardCard],
    leftoverEdges: sanitizeEdges(stayEdges),
    subBoardCard,
  };
}

/**
 * Plan for moving cards onto an existing board card.
 * Unlike `planCollectIntoBoard`, one card is enough and no new card is created.
 * Cards whose `blockId` is the target board (cannot nest B inside B) are dropped
 * from the payload; null when nothing remains, or when the target is A itself.
 */
export function planDropOntoBoard(input: {
  cards: readonly WhiteboardCard[];
  edges: readonly WhiteboardEdge[];
  movingIds: ReadonlySet<DbId>;
  targetBoardId: DbId;
  currentBoardId: DbId;
  origin?: { x: number; y: number };
}): DropOntoBoardPlan | null {
  if (input.targetBoardId === input.currentBoardId) return null;

  const moving = input.cards.filter(
    (card) =>
      input.movingIds.has(card.blockId) && card.blockId !== input.targetBoardId,
  );
  if (moving.length === 0) return null;

  const movingSet = new Set(moving.map((card) => card.blockId));
  const origin = input.origin ?? { x: GRID_ORIGIN, y: GRID_ORIGIN };
  const { movedEdges, stayEdges } = splitEdgesForMove(
    input.edges,
    movingSet,
    input.targetBoardId,
  );

  return {
    movedCards: translateGroupToOrigin(moving, origin.x, origin.y),
    movedEdges,
    leftoverCards: input.cards.filter((card) => !movingSet.has(card.blockId)),
    leftoverEdges: sanitizeEdges(stayEdges),
    targetBoardId: input.targetBoardId,
  };
}
