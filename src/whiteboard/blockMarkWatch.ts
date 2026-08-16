import type { DbId } from "../orca.d.ts";
import { isWhiteboardBlock, type BlockPropsLike } from "./pageBoardPlan";

export function asWatchBlockId(value: unknown): DbId | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value === "") return null;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

/** Parse `orca.delete-blocks` / `orca.refresh-blocks` handler args. */
export function dbIdsFromBroadcastArgs(args: readonly unknown[]): DbId[] {
  const ids: DbId[] = [];
  const seen = new Set<DbId>();
  const add = (value: unknown): void => {
    const id = asWatchBlockId(value);
    if (id == null || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  for (const arg of args) {
    if (Array.isArray(arg)) {
      for (const item of arg) add(item);
      continue;
    }
    add(arg);
  }
  return ids;
}

export function shouldDropIndexedBoard(block: BlockPropsLike): boolean {
  return block == null || !isWhiteboardBlock(block);
}

export type IndexedBoardOps = {
  deleted: DbId[];
  touched: DbId[];
};

/**
 * Which already-indexed boards appear in a Valtio `orca.state.blocks` ops
 * batch. Top-level delete → `deleted`. Any other set/delete on that id
 * (including nested `_repr` / properties) → `touched`.
 */
export function indexedBoardIdsFromOps(
  ops: unknown,
  indexed: { has(id: DbId): boolean },
): IndexedBoardOps | null {
  if (!Array.isArray(ops)) return null;
  const deleted: DbId[] = [];
  const touched: DbId[] = [];
  const seenDel = new Set<DbId>();
  const seenTouch = new Set<DbId>();
  for (const item of ops) {
    if (!Array.isArray(item) || item.length < 2) return null;
    const type = item[0];
    const path = item[1];
    if (!Array.isArray(path) || path.length < 1) continue;
    if (type !== "set" && type !== "delete") continue;
    const id = asWatchBlockId(path[0]);
    if (id == null || !indexed.has(id)) continue;
    if (type === "delete" && path.length === 1) {
      if (!seenDel.has(id)) {
        seenDel.add(id);
        deleted.push(id);
      }
      continue;
    }
    if (seenDel.has(id) || seenTouch.has(id)) continue;
    seenTouch.add(id);
    touched.push(id);
  }
  return { deleted, touched };
}
