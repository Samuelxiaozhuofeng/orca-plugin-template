import type { DbId } from "../orca.d.ts";
import type { WhiteboardCard } from "./cards";
import type { WhiteboardEdge } from "./edges";

export const HISTORY_LIMIT = 50;

export type BoardSnapshot = {
  cards: WhiteboardCard[];
  edges: WhiteboardEdge[];
};

type BoardHistory = {
  past: BoardSnapshot[];
  future: BoardSnapshot[];
};

const histories = new Map<DbId, BoardHistory>();
let holdCount = 0;
let blankUndoTold = false;

export function cloneSnapshot(snapshot: BoardSnapshot): BoardSnapshot {
  return {
    cards: snapshot.cards.map((card) => ({ ...card })),
    edges: snapshot.edges.map((edge) => ({ ...edge })),
  };
}

function getOrCreate(boardId: DbId): BoardHistory {
  let history = histories.get(boardId);
  if (history == null) {
    history = { past: [], future: [] };
    histories.set(boardId, history);
  }
  return history;
}

const retainCounts = new Map<DbId, number>();

export function clearBoardHistory(boardId: DbId): void {
  histories.delete(boardId);
  retainCounts.delete(boardId);
}

/** Keep undo history until the last panel of this board unmounts. */
export function retainBoardHistory(boardId: DbId): () => void {
  retainCounts.set(boardId, (retainCounts.get(boardId) ?? 0) + 1);
  return () => {
    const next = (retainCounts.get(boardId) ?? 1) - 1;
    if (next <= 0) {
      retainCounts.delete(boardId);
      histories.delete(boardId);
      return;
    }
    retainCounts.set(boardId, next);
  };
}

export function resetAllHistory(): void {
  histories.clear();
  retainCounts.clear();
  holdCount = 0;
  blankUndoTold = false;
}

export function isHistoryHeld(): boolean {
  return holdCount > 0;
}

export function holdHistory(): () => void {
  holdCount += 1;
  return () => {
    holdCount = Math.max(0, holdCount - 1);
  };
}

export function canUndo(boardId: DbId): boolean {
  return (histories.get(boardId)?.past.length ?? 0) > 0;
}

export function canRedo(boardId: DbId): boolean {
  return (histories.get(boardId)?.future.length ?? 0) > 0;
}

export function historyDepth(boardId: DbId): number {
  return histories.get(boardId)?.past.length ?? 0;
}

export function recordBefore(boardId: DbId, current: BoardSnapshot): void {
  if (holdCount > 0) return;
  const history = getOrCreate(boardId);
  history.past.push(cloneSnapshot(current));
  if (history.past.length > HISTORY_LIMIT) history.past.shift();
  history.future = [];
}

export function discardLastRecord(boardId: DbId): void {
  histories.get(boardId)?.past.pop();
}

export function takeUndo(
  boardId: DbId,
  current: BoardSnapshot,
): BoardSnapshot | null {
  const history = histories.get(boardId);
  const prev = history?.past.pop();
  if (prev == null || history == null) return null;
  history.future.push(cloneSnapshot(current));
  return prev;
}

export function takeRedo(
  boardId: DbId,
  current: BoardSnapshot,
): BoardSnapshot | null {
  const history = histories.get(boardId);
  const next = history?.future.pop();
  if (next == null || history == null) return null;
  history.past.push(cloneSnapshot(current));
  if (history.past.length > HISTORY_LIMIT) history.past.shift();
  return next;
}

export function restoreFailedUndo(boardId: DbId): void {
  const history = histories.get(boardId);
  const pushed = history?.future.pop();
  if (pushed == null || history == null) return;
  history.past.push(pushed);
  if (history.past.length > HISTORY_LIMIT) history.past.shift();
}

export function restoreFailedRedo(boardId: DbId): void {
  const history = histories.get(boardId);
  const pushed = history?.past.pop();
  if (pushed == null || history == null) return;
  history.future.push(pushed);
}

/** Keep live `linked` on edges that still exist. Deleted edges follow the snapshot. */
export function preserveLinked(
  snapshotEdges: readonly WhiteboardEdge[],
  currentEdges: readonly WhiteboardEdge[],
): WhiteboardEdge[] {
  const live = new Map(currentEdges.map((edge) => [edge.id, edge]));
  return snapshotEdges.map((edge) => {
    const now = live.get(edge.id);
    if (now?.linked === true) return { ...edge, linked: true };
    return { ...edge };
  });
}

export function edgesMatchIgnoringLinked(
  left: readonly WhiteboardEdge[],
  right: readonly WhiteboardEdge[],
): boolean {
  if (left.length !== right.length) return false;
  const rightById = new Map(right.map((edge) => [edge.id, edge]));
  for (const item of left) {
    const other = rightById.get(item.id);
    if (other == null) return false;
    if (
      item.from !== other.from ||
      item.to !== other.to ||
      item.label !== other.label ||
      item.arrow !== other.arrow ||
      item.fromSide !== other.fromSide ||
      item.toSide !== other.toSide
    ) {
      return false;
    }
  }
  return true;
}

export function cardPatchesChange(
  cards: readonly WhiteboardCard[],
  entries: ReadonlyArray<{
    blockId: DbId;
    patch: { x?: number; y?: number; w?: number; h?: number; color?: string };
  }>,
): boolean {
  if (entries.length === 0) return false;
  const byId = new Map<DbId, (typeof entries)[number]["patch"]>();
  for (const entry of entries) {
    const prev = byId.get(entry.blockId);
    byId.set(entry.blockId, prev == null ? entry.patch : { ...prev, ...entry.patch });
  }
  for (const card of cards) {
    const patch = byId.get(card.blockId);
    if (patch == null) continue;
    if (patch.x != null && patch.x !== card.x) return true;
    if (patch.y != null && patch.y !== card.y) return true;
    if (patch.w != null && patch.w !== card.w) return true;
    if (patch.h != null && patch.h !== card.h) return true;
    if ("color" in patch && patch.color !== card.color) return true;
  }
  return false;
}

export function shouldTellBlankCardUndo(): boolean {
  if (blankUndoTold) return false;
  blankUndoTold = true;
  return true;
}

export async function runAsHistoryStep<T>(
  boardId: DbId,
  current: BoardSnapshot,
  run: () => Promise<T>,
): Promise<T> {
  recordBefore(boardId, current);
  const release = holdHistory();
  try {
    return await run();
  } finally {
    release();
  }
}
