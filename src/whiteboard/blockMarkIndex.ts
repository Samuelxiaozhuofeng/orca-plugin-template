import type { DbId } from "../orca.d.ts";
import { boardName, readCards } from "./data";
import type { CardBoardRef } from "./blockMarkLabel";

export type { CardBoardRef };

export type BoardCardIndex = {
  boardId: DbId;
  name: string;
  cardIds: readonly DbId[];
};

type BoardLike = {
  id?: DbId;
  aliases?: string[];
  text?: string;
  properties?: readonly { name: string; value?: unknown }[];
};

export function uniqueCardIds(cards: readonly { blockId: DbId }[]): DbId[] {
  const ids: DbId[] = [];
  const seen = new Set<DbId>();
  for (const card of cards) {
    if (seen.has(card.blockId)) continue;
    seen.add(card.blockId);
    ids.push(card.blockId);
  }
  return ids;
}

function removeOneBoard(
  table: Map<DbId, CardBoardRef[]>,
  cardId: DbId,
  boardId: DbId,
): void {
  const refs = table.get(cardId);
  if (refs == null) return;
  const next = refs.filter((item) => item.id !== boardId);
  if (next.length === 0) table.delete(cardId);
  else table.set(cardId, next);
}

function addOneBoard(
  table: Map<DbId, CardBoardRef[]>,
  cardId: DbId,
  ref: CardBoardRef,
): void {
  const refs = table.get(cardId);
  if (refs == null) {
    table.set(cardId, [ref]);
    return;
  }
  if (refs.some((item) => item.id === ref.id)) return;
  refs.push(ref);
}

/** Patch one board's contribution into the outline-mark table. Mutates `table`. */
export function applyBoardCardIndex(
  table: Map<DbId, CardBoardRef[]>,
  prev: BoardCardIndex | null,
  next: BoardCardIndex | null,
): Map<DbId, CardBoardRef[]> {
  if (prev != null) {
    const seen = new Set<DbId>();
    for (const id of prev.cardIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      removeOneBoard(table, id, prev.boardId);
    }
  }
  if (next != null) {
    const seen = new Set<DbId>();
    const ref: CardBoardRef = { id: next.boardId, name: next.name };
    for (const id of next.cardIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      addOneBoard(table, id, ref);
    }
  }
  return table;
}

export function boardCardIndexFrom(
  boardId: DbId,
  name: string,
  cards: readonly { blockId: DbId }[],
): BoardCardIndex {
  return { boardId, name, cardIds: uniqueCardIds(cards) };
}

export function collectCardBoards(
  boards: readonly BoardLike[],
): Map<DbId, CardBoardRef[]> {
  const byBlock = new Map<DbId, CardBoardRef[]>();
  for (const board of boards) {
    if (typeof board.id !== "number" || !Number.isFinite(board.id)) continue;
    const name = boardName(board);
    const seen = new Set<DbId>();
    for (const card of readCards(board)) {
      if (seen.has(card.blockId)) continue;
      seen.add(card.blockId);
      addOneBoard(byBlock, card.blockId, { id: board.id, name });
    }
  }
  return byBlock;
}
