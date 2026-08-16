import type { DbId } from "../orca.d.ts";

/**
 * Whiteboards are not deep trees. Eight hops is more than a person will nest
 * by hand, and the visit set stops walking if a cycle already exists.
 */
export const NEST_CYCLE_MAX_DEPTH = 8;

/**
 * True when putting `movingIds` onto `targetBoardId` would create a cycle:
 * some moving board already contains the target (A contains B, drop A onto B).
 */
export function nestWouldCycle(opts: {
  movingIds: readonly DbId[];
  targetBoardId: DbId;
  childrenOf: (boardId: DbId) => readonly DbId[] | null;
  maxDepth?: number;
}): boolean {
  const max = opts.maxDepth ?? NEST_CYCLE_MAX_DEPTH;
  const target = opts.targetBoardId;

  const contains = (
    root: DbId,
    needle: DbId,
    depth: number,
    seen: Set<DbId>,
  ): boolean => {
    if (root === needle) return true;
    if (depth >= max) return false;
    if (seen.has(root)) return false;
    seen.add(root);
    const kids = opts.childrenOf(root);
    if (kids == null) return false;
    for (const kid of kids) {
      if (contains(kid, needle, depth + 1, seen)) return true;
    }
    return false;
  };

  for (const id of opts.movingIds) {
    if (id === target) continue;
    if (contains(id, target, 0, new Set())) return true;
  }
  return false;
}
