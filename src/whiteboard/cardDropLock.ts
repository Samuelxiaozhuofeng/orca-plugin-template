import type { DbId } from "../orca.d.ts";

const locked = new Set<DbId>();

export function lockCardMoves(ids: readonly DbId[]): void {
  for (const id of ids) locked.add(id);
}

export function unlockCardMoves(ids: readonly DbId[]): void {
  for (const id of ids) locked.delete(id);
}

export function cardMovesLocked(ids: ReadonlySet<DbId> | readonly DbId[]): boolean {
  for (const id of ids) {
    if (locked.has(id)) return true;
  }
  return false;
}
