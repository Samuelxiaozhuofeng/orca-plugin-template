import type { DbId } from "../orca.d.ts";
import { areasEqual, type WhiteboardArea } from "./areas.ts";
import { cardsEqual, type WhiteboardCard } from "./cards.ts";
import { bendsEqual, edgesEqual, type WhiteboardEdge } from "./edges.ts";

export const HISTORY_LIMIT = 50;

export type BoardSnapshot = {
  cards: WhiteboardCard[];
  edges: WhiteboardEdge[];
  areas?: WhiteboardArea[];
};

type HistoryAreasApi = {
  read: (boardId: DbId) => WhiteboardArea[];
  apply: (boardId: DbId, areas: WhiteboardArea[]) => void;
};

let historyAreas: HistoryAreasApi | null = null;

/** Lets persist restore areas on undo/redo without a history→queue import. */
export function bindHistoryAreas(api: HistoryAreasApi): void {
  historyAreas = api;
}

function readLiveAreas(boardId: DbId): WhiteboardArea[] {
  return historyAreas?.read(boardId) ?? [];
}

function hydrateAreas(boardId: DbId, snapshot: BoardSnapshot): BoardSnapshot {
  if (snapshot.areas != null) return snapshot;
  return { ...snapshot, areas: readLiveAreas(boardId) };
}

function syncAreasFromSnapshot(boardId: DbId, snapshot: BoardSnapshot): void {
  if (historyAreas == null) return;
  const next = snapshot.areas ?? readLiveAreas(boardId);
  if (areasEqual(historyAreas.read(boardId), next)) return;
  historyAreas.apply(boardId, next);
}

type BoardHistory = {
  past: BoardSnapshot[];
  future: BoardSnapshot[];
};

const histories = new Map<DbId, BoardHistory>();
const holdCounts = new Map<DbId | "global", number>();
let blankUndoTold = false;

export function cloneSnapshot(snapshot: BoardSnapshot): BoardSnapshot {
  return {
    cards: snapshot.cards.map((card) => ({ ...card })),
    edges: snapshot.edges.map((edge) => {
      if (edge.bend == null) return { ...edge };
      return {
        ...edge,
        bend: {
          from: { ...edge.bend.from },
          to: { ...edge.bend.to },
        },
      };
    }),
    areas: (snapshot.areas ?? []).map((area) => ({ ...area })),
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
  holdCounts.clear();
  blankUndoTold = false;
}

export function isHistoryHeld(boardId?: DbId): boolean {
  if (boardId != null) {
    return (
      (holdCounts.get(boardId) ?? 0) > 0 ||
      (holdCounts.get("global") ?? 0) > 0
    );
  }
  return holdCounts.size > 0;
}

export function holdHistory(boardId?: DbId): () => void {
  const key: DbId | "global" = boardId ?? "global";
  holdCounts.set(key, (holdCounts.get(key) ?? 0) + 1);
  return () => {
    const next = (holdCounts.get(key) ?? 1) - 1;
    if (next <= 0) holdCounts.delete(key);
    else holdCounts.set(key, next);
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
  if ((holdCounts.get(boardId) ?? 0) > 0) return;
  if ((holdCounts.get("global") ?? 0) > 0) return;
  const history = getOrCreate(boardId);
  history.past.push(cloneSnapshot(hydrateAreas(boardId, current)));
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
  history.future.push(cloneSnapshot(hydrateAreas(boardId, current)));
  syncAreasFromSnapshot(boardId, prev);
  return prev;
}

export function takeRedo(
  boardId: DbId,
  current: BoardSnapshot,
): BoardSnapshot | null {
  const history = histories.get(boardId);
  const next = history?.future.pop();
  if (next == null || history == null) return null;
  history.past.push(cloneSnapshot(hydrateAreas(boardId, current)));
  if (history.past.length > HISTORY_LIMIT) history.past.shift();
  syncAreasFromSnapshot(boardId, next);
  return next;
}

/** Put `prev` back when given, so a failed undo can be retried. */
export function restoreFailedUndo(boardId: DbId, prev?: BoardSnapshot): void {
  const history = histories.get(boardId);
  const pushed = history?.future.pop();
  if (history == null) return;
  const back = prev ?? pushed;
  if (back == null) return;
  history.past.push(back);
  if (history.past.length > HISTORY_LIMIT) history.past.shift();
}

export function restoreFailedRedo(boardId: DbId, next?: BoardSnapshot): void {
  const history = histories.get(boardId);
  const pushed = history?.past.pop();
  if (history == null) return;
  const back = next ?? pushed;
  if (back == null) return;
  history.future.push(back);
}

export type SnapshotWriteMode = "cards-and-areas" | "board" | "areas" | "none";

export type SnapshotWritePlan = {
  mode: SnapshotWriteMode;
  cards: WhiteboardCard[];
  edges: WhiteboardEdge[];
  areas: WhiteboardArea[];
};

/** Which persist lane(s) undo/redo must write to restore `next`. */
export function planSnapshotWrite(
  next: BoardSnapshot,
  current: BoardSnapshot,
): SnapshotWritePlan {
  const nextEdges = preserveLinked(next.edges, current.edges);
  const nextAreas = next.areas ?? current.areas ?? [];
  const currentAreas = current.areas ?? [];
  const cardsChanged = !cardsEqual(next.cards, current.cards);
  const edgesChanged = !edgesEqual(nextEdges, current.edges);
  const areaChanged = !areasEqual(nextAreas, currentAreas);
  const mode: SnapshotWriteMode =
    cardsChanged && areaChanged && !edgesChanged
      ? "cards-and-areas"
      : cardsChanged || edgesChanged
        ? "board"
        : areaChanged
          ? "areas"
          : "none";
  return { mode, cards: next.cards, edges: nextEdges, areas: nextAreas };
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
      item.toSide !== other.toSide ||
      item.color !== other.color ||
      item.style !== other.style ||
      !bendsEqual(item.bend, other.bend)
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
  const release = holdHistory(boardId);
  try {
    return await run();
  } finally {
    release();
  }
}
