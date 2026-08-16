import type { DbId } from "../orca.d.ts";
import { areasPropertyPresent, tryReadAreas, type WhiteboardArea } from "./areas";
import {
  cloneSnapshot,
  historyDepth,
  holdHistory,
  takeRedo,
  takeUndo,
  type BoardSnapshot,
} from "./boardHistory";
import { commitBoardOn } from "./boardPersistCommit";
import { getBoardSession, writeSessionSnapshot } from "./boardSession";
import { loadBoardBlock } from "./boardWrite";
import { cardsEqual, type WhiteboardCard } from "./cards";
import type { WhiteboardEdge } from "./edges";

export type DropCouple = {
  a: DbId;
  b: DbId;
  aDepth: number;
  bDepth: number | null;
  movedIds: readonly DbId[];
  aBefore: BoardSnapshot;
  bBefore: BoardSnapshot;
  aAfter: BoardSnapshot;
  bAfter: BoardSnapshot;
  undone: boolean;
  dead: boolean;
};

const couples: DropCouple[] = [];

export function registerDropCouple(
  input: Omit<DropCouple, "undone" | "dead">,
): DropCouple {
  const couple: DropCouple = { ...input, undone: false, dead: false };
  couples.push(couple);
  return couple;
}

/** A new local edit after a paired undo cancels redo-across-boards. */
export function noteIndependentMutation(boardId: DbId): void {
  for (const couple of couples) {
    if (couple.dead) continue;
    if (!couple.undone) continue;
    if (couple.a === boardId || couple.b === boardId) couple.dead = true;
  }
}

export function coupleForUndo(
  boardId: DbId,
  undoneDepth: number,
): DropCouple | null {
  for (let i = couples.length - 1; i >= 0; i--) {
    const couple = couples[i];
    if (couple.dead || couple.undone) continue;
    if (couple.a === boardId && couple.aDepth === undoneDepth) return couple;
    if (couple.b === boardId && couple.bDepth === undoneDepth) return couple;
  }
  return null;
}

export function coupleForRedo(
  boardId: DbId,
  redoneDepth: number,
): DropCouple | null {
  for (let i = couples.length - 1; i >= 0; i--) {
    const couple = couples[i];
    if (couple.dead || !couple.undone) continue;
    if (couple.a === boardId && couple.aDepth === redoneDepth) return couple;
    if (couple.b === boardId && couple.bDepth === redoneDepth) return couple;
  }
  return null;
}

function liveSnapshot(id: DbId, fallback: BoardSnapshot): BoardSnapshot {
  const session = getBoardSession(id);
  if (session == null || !session.hydrated) return fallback;
  return {
    cards: session.cards.map((card) => ({ ...card })),
    edges: session.edges.map((edge) => ({ ...edge })),
    areas: session.areas.map((area) => ({ ...area })),
  };
}

function subtractMoved(
  cards: readonly WhiteboardCard[],
  movedIds: ReadonlySet<DbId>,
): WhiteboardCard[] {
  return cards.filter((card) => !movedIds.has(card.blockId));
}

function unionMoved(
  current: readonly WhiteboardCard[],
  incoming: readonly WhiteboardCard[],
): WhiteboardCard[] {
  const have = new Set(current.map((card) => card.blockId));
  const extra = incoming.filter((card) => !have.has(card.blockId));
  return [...current.map((card) => ({ ...card })), ...extra.map((card) => ({ ...card }))];
}

function snapshotForUndo(
  couple: DropCouple,
  otherId: DbId,
  live: BoardSnapshot,
): BoardSnapshot {
  const moved = new Set(couple.movedIds);
  if (otherId === couple.b) {
    const untouched = cardsEqual(live.cards, couple.bAfter.cards);
    return {
      cards: untouched
        ? couple.bBefore.cards.map((card) => ({ ...card }))
        : subtractMoved(live.cards, moved),
      edges: untouched
        ? couple.bBefore.edges.map((edge) => ({ ...edge }))
        : live.edges.map((edge) => ({ ...edge })),
      areas: live.areas ?? couple.bBefore.areas,
    };
  }
  const untouched = cardsEqual(live.cards, couple.aAfter.cards);
  return {
    cards: untouched
      ? couple.aBefore.cards.map((card) => ({ ...card }))
      : unionMoved(live.cards, couple.aBefore.cards.filter((card) => moved.has(card.blockId))),
    edges: untouched
      ? couple.aBefore.edges.map((edge) => ({ ...edge }))
      : live.edges.map((edge) => ({ ...edge })),
    areas: live.areas ?? couple.aBefore.areas,
  };
}

function snapshotForRedo(
  couple: DropCouple,
  otherId: DbId,
  live: BoardSnapshot,
): BoardSnapshot {
  const moved = new Set(couple.movedIds);
  if (otherId === couple.b) {
    const untouched = cardsEqual(live.cards, couple.bBefore.cards);
    return {
      cards: untouched
        ? couple.bAfter.cards.map((card) => ({ ...card }))
        : unionMoved(live.cards, couple.bAfter.cards.filter((card) => moved.has(card.blockId))),
      edges: untouched
        ? couple.bAfter.edges.map((edge) => ({ ...edge }))
        : live.edges.map((edge) => ({ ...edge })),
      areas: live.areas ?? couple.bAfter.areas,
    };
  }
  const untouched = cardsEqual(live.cards, couple.aBefore.cards);
  return {
    cards: untouched
      ? couple.aAfter.cards.map((card) => ({ ...card }))
      : subtractMoved(live.cards, moved),
    edges: untouched
      ? couple.aAfter.edges.map((edge) => ({ ...edge }))
      : live.edges.map((edge) => ({ ...edge })),
    areas: live.areas ?? couple.aAfter.areas,
  };
}

export async function writeBoardCardsEdges(
  id: DbId,
  cards: WhiteboardCard[],
  edges: WhiteboardEdge[],
): Promise<boolean> {
  const session = getBoardSession(id);
  if (session != null && session.hydrated && !session.protect) {
    return commitBoardOn(session, cards, edges);
  }
  try {
    const block = (await loadBoardBlock(id)) ?? orca.state.blocks[id];
    const areasRead = tryReadAreas(block ?? undefined);
    await writeSessionSnapshot(
      id,
      cards,
      edges,
      areasRead.ok ? areasRead.value : [],
      areasPropertyPresent(block ?? undefined),
    );
    return true;
  } catch (err: unknown) {
    console.error("[whiteboard] paired board write failed", id, err);
    return false;
  }
}

export async function restorePairedBoard(
  couple: DropCouple,
  actedBoard: DbId,
  kind: "undo" | "redo",
): Promise<void> {
  const other = actedBoard === couple.a ? couple.b : couple.a;
  const fallback = other === couple.a
    ? kind === "undo"
      ? couple.aAfter
      : couple.aBefore
    : kind === "undo"
      ? couple.bAfter
      : couple.bBefore;
  const live = liveSnapshot(other, fallback);
  const next =
    kind === "undo"
      ? snapshotForUndo(couple, other, live)
      : snapshotForRedo(couple, other, live);

  const otherDepth = other === couple.a ? couple.aDepth : couple.bDepth;
  if (otherDepth != null) {
    if (kind === "undo" && historyDepth(other) === otherDepth) {
      takeUndo(other, live);
    } else if (kind === "redo" && historyDepth(other) === otherDepth - 1) {
      takeRedo(other, live);
    }
  }

  const release = holdHistory(other);
  try {
    await writeBoardCardsEdges(other, next.cards, next.edges);
  } finally {
    release();
  }

  if (kind === "undo") couple.undone = true;
  else couple.undone = false;
}

export function cloneBoardSnapshot(
  cards: readonly WhiteboardCard[],
  edges: readonly WhiteboardEdge[],
  areas?: readonly WhiteboardArea[],
): BoardSnapshot {
  return cloneSnapshot({
    cards: cards.map((card) => ({ ...card })),
    edges: edges.map((edge) => ({ ...edge })),
    areas: (areas ?? []).map((area) => ({ ...area })),
  });
}
