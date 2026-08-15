import type { DbId } from "../orca.d.ts";

export type BoardCardIndex = {
  name: string;
  cardIds: readonly DbId[];
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

function removeOneName(
  table: Map<DbId, string[]>,
  cardId: DbId,
  name: string,
): void {
  const names = table.get(cardId);
  if (names == null) return;
  const next = names.filter((item) => item !== name);
  if (next.length === 0) table.delete(cardId);
  else table.set(cardId, next);
}

function addOneName(
  table: Map<DbId, string[]>,
  cardId: DbId,
  name: string,
): void {
  const names = table.get(cardId);
  if (names) names.push(name);
  else table.set(cardId, [name]);
}

/** Patch one board's contribution into the outline-mark table. Mutates `table`. */
export function applyBoardCardIndex(
  table: Map<DbId, string[]>,
  prev: BoardCardIndex | null,
  next: BoardCardIndex | null,
): Map<DbId, string[]> {
  if (prev != null) {
    const seen = new Set<DbId>();
    for (const id of prev.cardIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      removeOneName(table, id, prev.name);
    }
  }
  if (next != null) {
    const seen = new Set<DbId>();
    for (const id of next.cardIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      addOneName(table, id, next.name);
    }
  }
  return table;
}

export function boardCardIndexFrom(
  name: string,
  cards: readonly { blockId: DbId }[],
): BoardCardIndex {
  return { name, cardIds: uniqueCardIds(cards) };
}
