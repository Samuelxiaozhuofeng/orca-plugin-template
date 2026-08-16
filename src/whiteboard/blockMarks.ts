import type { DbId } from "../orca.d.ts";
import { onBoardCardsChanged } from "./boardEvents";
import {
  ensureBlocksLoaded,
  fetchWhiteboardBlocks,
  rememberInlineBoardId,
} from "./boards";
import { boardName, PANEL_TYPE, readCards } from "./data";
import {
  applyBoardCardIndex,
  boardCardIndexFrom,
  collectCardBoards,
  type BoardCardIndex,
  type CardBoardRef,
} from "./blockMarkIndex";
import { currentBoardIdFromPanel } from "./blockMarkLabel";
import {
  BLOCK_MARKS_CSS_ROLE,
  buildBlockMarkCss,
  injectMarkStyles,
  OWB_MARK_ATTR,
  OWB_MARK_LABEL_ATTR,
  rescanDom,
  restampBlockIds,
  setMarkStampCtx,
  startObserver,
  teardownMarks,
} from "./blockMarkDom";
import {
  dbIdsFromBroadcastArgs,
  indexedBoardIdsFromOps,
  shouldDropIndexedBoard,
} from "./blockMarkWatch";
import { rememberPageBoardInCache } from "./pageBoardListCache";
import {
  asBlockId,
  isPageWhiteboardBlock,
  isWhiteboardBlock,
} from "./pageBoardPlan";
import { readWhiteboardSettings } from "./settings";

export { applyBoardCardIndex, collectCardBoards, type BoardCardIndex } from "./blockMarkIndex";
export {
  markLabelFor,
  outlineMarkLabel,
  type CardBoardRef,
} from "./blockMarkLabel";
export {
  BLOCK_MARKS_CSS_ROLE,
  buildBlockMarkCss,
  OWB_MARK_ATTR,
  OWB_MARK_LABEL_ATTR,
};

const DEBOUNCE_MS = 300;
const DELETE_BLOCKS_MSG = "orca.delete-blocks";
const REFRESH_BLOCKS_MSG = "orca.refresh-blocks";

let pluginName = "";
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeCards: (() => void) | null = null;
let unsubscribeSettings: (() => void) | null = null;
let unsubscribeNav: (() => void) | null = null;
let unsubscribeBlocks: (() => void) | null = null;
let rebuildSeq = 0;
let lastEnabled: boolean | undefined;

let cardBoards = new Map<DbId, CardBoardRef[]>();
let lastByBoard = new Map<DbId, BoardCardIndex>();
let currentBoardId: DbId | null = null;
const pendingBoardIds = new Set<DbId>();
const forceGoneBoardIds = new Set<DbId>();

export function startBlockMarks(name: string): void {
  stopBlockMarks();
  pluginName = name;
  lastEnabled = marksEnabled();
  unsubscribeCards = onBoardCardsChanged((boardId) => {
    pendingBoardIds.add(boardId);
    scheduleBoardFlush();
  });
  unsubscribeSettings = subscribePlugins(onPluginsChanged);
  unsubscribeNav = subscribeNav(onNavChanged);
  unsubscribeBlocks = subscribeBlocks(onBlocksChanged);
  bindHostBlockHandlers();
  currentBoardId = readCurrentBoardId();
  syncStampCtx();
  void rebuildBlockMarks();
}

export function stopBlockMarks(): void {
  rebuildSeq += 1;
  if (debounceTimer != null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  unsubscribeCards?.();
  unsubscribeCards = null;
  unsubscribeSettings?.();
  unsubscribeSettings = null;
  unsubscribeNav?.();
  unsubscribeNav = null;
  unsubscribeBlocks?.();
  unsubscribeBlocks = null;
  unbindHostBlockHandlers();
  lastEnabled = undefined;
  pluginName = "";
  cardBoards = new Map();
  lastByBoard = new Map();
  currentBoardId = null;
  pendingBoardIds.clear();
  forceGoneBoardIds.clear();
  teardownMarks();
}

function valtioSubscribe():
  | ((
      proxyObject: object,
      cb: (...args: unknown[]) => void,
      notifyInSync?: boolean,
    ) => () => void)
  | undefined {
  return (
    globalThis as {
      window?: {
        Valtio?: {
          subscribe: (
            proxyObject: object,
            cb: (...args: unknown[]) => void,
            notifyInSync?: boolean,
          ) => () => void;
        };
      };
    }
  ).window?.Valtio?.subscribe;
}

function subscribePlugins(callback: () => void): () => void {
  const subscribe = valtioSubscribe();
  if (subscribe == null) return () => {};
  return subscribe(orca.state.plugins, callback);
}

function subscribeNav(callback: () => void): () => void {
  const subscribe = valtioSubscribe();
  if (subscribe == null) return () => {};
  const unsubs: Array<() => void> = [];
  try {
    unsubs.push(subscribe(orca.state.panels, callback));
  } catch {
    // Panels tree unavailable; still try the root state below.
  }
  try {
    unsubs.push(subscribe(orca.state, callback));
  } catch {
    // No live panel updates: labels stay visible (degrade).
  }
  return () => {
    for (const unsub of unsubs) unsub();
  };
}

function subscribeBlocks(callback: (ops: unknown) => void): () => void {
  const subscribe = valtioSubscribe();
  if (subscribe == null) return () => {};
  try {
    return subscribe(orca.state.blocks, callback, true);
  } catch {
    return () => {};
  }
}

function bindHostBlockHandlers(): void {
  try {
    orca.broadcasts.registerHandler(DELETE_BLOCKS_MSG, onDeleteBlocks);
    orca.broadcasts.registerHandler(REFRESH_BLOCKS_MSG, onRefreshBlocks);
  } catch {
    // Host broadcasts unavailable (tests / early load).
  }
}

function unbindHostBlockHandlers(): void {
  try {
    orca.broadcasts.unregisterHandler(DELETE_BLOCKS_MSG, onDeleteBlocks);
    orca.broadcasts.unregisterHandler(REFRESH_BLOCKS_MSG, onRefreshBlocks);
  } catch {
    // Already gone.
  }
}

function readCurrentBoardId(): DbId | null {
  try {
    const panelId = orca.state?.activePanel;
    if (typeof panelId !== "string" || panelId === "") return null;
    const find = orca.nav?.findViewPanel;
    if (typeof find !== "function") return null;
    const panel = find(panelId, orca.state.panels);
    const rootId = asBlockId(panel?.viewArgs?.blockId);
    const isBoard =
      panel?.view === "block" &&
      rootId != null &&
      isWhiteboardBlock(orca.state.blocks?.[rootId]);
    return currentBoardIdFromPanel(panel, {
      panelType: PANEL_TYPE,
      isWhiteboardView: isBoard,
    });
  } catch {
    return null;
  }
}

function syncStampCtx(): void {
  setMarkStampCtx({
    boardsFor: (id) => cardBoards.get(id),
    currentBoardId,
  });
}

function onNavChanged(): void {
  const next = readCurrentBoardId();
  if (next === currentBoardId) return;
  currentBoardId = next;
  syncStampCtx();
  if (!marksEnabled() || cardBoards.size === 0) return;
  rescanDom();
}

function onPluginsChanged(): void {
  const enabled = marksEnabled();
  if (enabled === lastEnabled) return;
  lastEnabled = enabled;
  if (enabled) {
    void rebuildBlockMarks();
    return;
  }
  teardownMarks();
}

function onDeleteBlocks(...args: unknown[]): void {
  queueIndexedBoards(dbIdsFromBroadcastArgs(args), true);
}

function onRefreshBlocks(...args: unknown[]): void {
  queueIndexedBoards(dbIdsFromBroadcastArgs(args), false);
}

function onBlocksChanged(ops?: unknown): void {
  const parsed = indexedBoardIdsFromOps(ops, lastByBoard);
  if (parsed == null) {
    for (const id of lastByBoard.keys()) {
      const block = orca.state?.blocks?.[id];
      if (block != null && shouldDropIndexedBoard(block)) {
        pendingBoardIds.add(id);
      }
    }
    if (pendingBoardIds.size > 0) scheduleBoardFlush();
    return;
  }
  for (const id of parsed.deleted) {
    forceGoneBoardIds.add(id);
    pendingBoardIds.add(id);
  }
  for (const id of parsed.touched) {
    const block = orca.state?.blocks?.[id];
    if (shouldDropIndexedBoard(block)) pendingBoardIds.add(id);
  }
  if (pendingBoardIds.size > 0) scheduleBoardFlush();
}

function queueIndexedBoards(ids: readonly DbId[], forceGone: boolean): void {
  let any = false;
  for (const id of ids) {
    if (!lastByBoard.has(id)) continue;
    if (forceGone) {
      forceGoneBoardIds.add(id);
      pendingBoardIds.add(id);
      any = true;
      continue;
    }
    if (shouldDropIndexedBoard(orca.state?.blocks?.[id])) {
      pendingBoardIds.add(id);
      any = true;
    }
  }
  if (any) scheduleBoardFlush();
}

function scheduleBoardFlush(): void {
  if (debounceTimer != null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void flushBoardUpdates();
  }, DEBOUNCE_MS);
}

async function flushBoardUpdates(): Promise<void> {
  const seq = rebuildSeq;
  const ids = [...pendingBoardIds];
  pendingBoardIds.clear();
  if (ids.length === 0) return;
  try {
    if (!marksEnabled()) {
      teardownMarks();
      return;
    }
    const affected = new Set<DbId>();
    for (const boardId of ids) {
      const changed = await applyLiveBoard(boardId);
      for (const id of changed) affected.add(id);
      if (seq !== rebuildSeq) return;
    }
    if (seq !== rebuildSeq) return;
    if (!marksEnabled()) {
      teardownMarks();
      return;
    }
    syncMarksAfterIds(affected);
  } catch (err) {
    console.error("[whiteboard] failed to update block marks", err);
  }
}

function dropIndexedBoard(boardId: DbId): DbId[] {
  const prev = lastByBoard.get(boardId) ?? null;
  forceGoneBoardIds.delete(boardId);
  if (prev == null) return [];
  applyBoardCardIndex(cardBoards, prev, null);
  lastByBoard.delete(boardId);
  return prev.cardIds.slice();
}

async function applyLiveBoard(boardId: DbId): Promise<DbId[]> {
  const prev = lastByBoard.get(boardId) ?? null;
  if (forceGoneBoardIds.has(boardId)) {
    return dropIndexedBoard(boardId);
  }
  const cached = orca.state.blocks[boardId];
  if (cached != null && shouldDropIndexedBoard(cached)) {
    return dropIndexedBoard(boardId);
  }
  await ensureBlocksLoaded([boardId]);
  const block = orca.state.blocks[boardId];
  if (block == null || !isWhiteboardBlock(block)) {
    return dropIndexedBoard(boardId);
  }
  if (isPageWhiteboardBlock(block)) rememberPageBoardInCache(boardId);
  else rememberInlineBoardId(boardId);
  const next = boardCardIndexFrom(boardId, boardName(block), readCards(block));
  if (
    prev != null &&
    prev.name === next.name &&
    prev.cardIds.length === next.cardIds.length &&
    prev.cardIds.every((id, i) => id === next.cardIds[i])
  ) {
    return [];
  }
  applyBoardCardIndex(cardBoards, prev, next);
  lastByBoard.set(boardId, next);
  const affected = new Set<DbId>(prev?.cardIds ?? []);
  for (const id of next.cardIds) affected.add(id);
  return [...affected];
}

function syncMarksAfterIds(ids: ReadonlySet<DbId>): void {
  if (!pluginName || cardBoards.size === 0) {
    teardownMarks();
    return;
  }
  syncStampCtx();
  injectMarkStyles(cardBoards.size);
  startObserver();
  restampBlockIds(ids);
}

async function rebuildBlockMarks(): Promise<void> {
  const seq = ++rebuildSeq;
  try {
    if (!marksEnabled()) {
      teardownMarks();
      return;
    }
    const boards = await fetchWhiteboardBlocks();
    if (seq !== rebuildSeq) return;
    if (!marksEnabled()) {
      teardownMarks();
      return;
    }
    lastByBoard = new Map();
    for (const board of boards) {
      if (typeof board.id !== "number") continue;
      lastByBoard.set(
        board.id,
        boardCardIndexFrom(board.id, boardName(board), readCards(board)),
      );
    }
    cardBoards = collectCardBoards(boards);
    syncMarksFromTable();
  } catch (err) {
    console.error("[whiteboard] failed to rebuild block marks", err);
  }
}

function syncMarksFromTable(): void {
  if (!pluginName || cardBoards.size === 0) {
    teardownMarks();
    return;
  }
  syncStampCtx();
  injectMarkStyles(cardBoards.size);
  startObserver();
  rescanDom();
}

function marksEnabled(): boolean {
  if (!pluginName) return false;
  return readWhiteboardSettings(
    orca.state.plugins[pluginName]?.settings as
      | Record<string, unknown>
      | undefined,
  ).markOutlineBlocks;
}
