import type {
  Block,
  ColumnPanel,
  DbId,
  RowPanel,
  ViewPanel,
} from "../orca.d.ts";
import { commitCardsOn } from "./boardPersistQueue";
import { getBoardSession, sessionCanAcceptCards } from "./boardSession";
import {
  boardName,
  PANEL_TYPE,
  readCards,
  WHITEBOARD_TYPE,
  type WhiteboardCard,
} from "./data";
import { fetchBlock } from "./newCard";
import {
  GET_BLOCKS_BATCH_SIZE,
  chunkIds,
  idsMissingFromBlocks,
  isInlineWhiteboardBlock,
  isPageWhiteboardBlock,
} from "./pageBoardPlan";
import {
  getFreshPageBoardIds,
  pageBoardCacheEpoch,
  storePageBoardIds,
} from "./pageBoardListCache";

export type BoardListItem = {
  id: DbId;
  name: string;
  cardCount: number;
};

export type BoardLocateHit = {
  boardId: DbId;
  name: string;
  cardBlockId: DbId;
  viaAncestor: boolean;
};

export type OpenBoard = {
  getCards: () => WhiteboardCard[];
  appendCards: (incoming: WhiteboardCard[]) => Promise<boolean>;
  focusCard: (cardBlockId: DbId) => boolean;
};

const PARENT_WALK_LIMIT = 20;

const openBoards = new Map<DbId, OpenBoard[]>();

export function registerOpenBoard(id: DbId, api: OpenBoard): () => void {
  const list = openBoards.get(id) ?? [];
  list.push(api);
  openBoards.set(id, list);
  return () => {
    const current = openBoards.get(id);
    if (current == null) return;
    const next = current.filter((item) => item !== api);
    if (next.length === 0) openBoards.delete(id);
    else openBoards.set(id, next);
  };
}

export function getOpenBoard(id: DbId): OpenBoard | null {
  const list = openBoards.get(id);
  if (list == null || list.length === 0) return null;
  const primary = list[list.length - 1];
  return {
    getCards: () => primary.getCards(),
    appendCards: (incoming) => primary.appendCards(incoming),
    focusCard: (cardBlockId) => {
      for (const api of list) {
        if (api.focusCard(cardBlockId)) return true;
      }
      return false;
    },
  };
}

/**
 * Prefer a live panel (undo-aware append). If the panel is gone but the
 * shared session is still flushing, write through the session instead of
 * the on-disk snapshot.
 */
export function getOpenOrSessionBoard(id: DbId): OpenBoard | null {
  const open = getOpenBoard(id);
  if (open != null) return open;
  const session = getBoardSession(id);
  if (!sessionCanAcceptCards(session)) return null;
  return {
    getCards: () => session.cards,
    appendCards: async (incoming) => {
      const occupied = new Set(session.cards.map((card) => card.blockId));
      const fresh = incoming.filter((card) => !occupied.has(card.blockId));
      if (fresh.length === 0) return true;
      return commitCardsOn(session, [...session.cards, ...fresh]);
    },
    focusCard: () => false,
  };
}

export function resetOpenBoardCaches(): void {
  openBoards.clear();
  inlineIdCache = null;
  inlineIdInflight = null;
  pageIdDiscover = null;
}

function asBlockId(value: unknown): DbId | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function collectIds(result: unknown): DbId[] {
  if (!Array.isArray(result)) return [];
  const ids: DbId[] = [];
  for (const item of result) {
    if (typeof item === "number") {
      const id = asBlockId(item);
      if (id != null) ids.push(id);
      continue;
    }
    if (item != null && typeof item === "object" && "id" in item) {
      const id = asBlockId((item as { id: unknown }).id);
      if (id != null) ids.push(id);
    }
  }
  return ids;
}

async function queryBlockIds(condition: object): Promise<DbId[]> {
  const result = await orca.invokeBackend("query", {
    q: {
      kind: 1,
      conditions: [condition],
    },
    pageSize: -1,
  });
  return collectIds(result);
}

function collectKnownWhiteboardIds(): DbId[] {
  const ids: DbId[] = [];
  for (const block of Object.values(orca.state.blocks)) {
    if (block == null) continue;
    if (!isPageWhiteboardBlock(block) && !isInlineWhiteboardBlock(block)) {
      continue;
    }
    const id = asBlockId(block.id);
    if (id != null) ids.push(id);
  }
  return ids;
}

function collectKnownPageBoardIds(): DbId[] {
  const ids: DbId[] = [];
  for (const block of Object.values(orca.state.blocks)) {
    if (block == null || !isPageWhiteboardBlock(block)) continue;
    const id = asBlockId(block.id);
    if (id != null) ids.push(id);
  }
  return ids;
}

async function loadMissingBlocks(ids: readonly DbId[]): Promise<void> {
  const missing = idsMissingFromBlocks(ids, orca.state.blocks);
  for (const batch of chunkIds(missing, GET_BLOCKS_BATCH_SIZE)) {
    try {
      const result =
        ((await orca.invokeBackend("get-blocks", batch)) as Block[] | null) ??
        [];
      if (!Array.isArray(result)) continue;
      for (const item of result) {
        if (item != null && typeof item.id === "number") {
          orca.state.blocks[item.id] = item;
        }
      }
    } catch (err: unknown) {
      console.warn("[whiteboard] get-blocks batch failed", err);
    }
  }
}

function uniqueIds(ids: readonly DbId[]): DbId[] {
  return [...new Set(ids)];
}

const INLINE_BOARD_ID_TTL_MS = 60_000;

let inlineIdCache: { ids: DbId[]; fetchedAt: number } | null = null;
let inlineIdInflight: Promise<DbId[]> | null = null;

function inlineBoardIdsFresh(now: number): boolean {
  return (
    inlineIdCache != null && now - inlineIdCache.fetchedAt < INLINE_BOARD_ID_TTL_MS
  );
}

async function inlineBoardIdsForList(now: number): Promise<DbId[]> {
  if (inlineBoardIdsFresh(now)) return [...(inlineIdCache?.ids ?? [])];
  if (inlineIdInflight != null) return inlineIdInflight;
  inlineIdInflight = (async () => {
    try {
      const ids = await queryBlockIds({
        kind: 9,
        types: { op: 5, value: [WHITEBOARD_TYPE] },
      });
      inlineIdCache = { ids, fetchedAt: Date.now() };
      return ids;
    } catch (err: unknown) {
      console.warn("[whiteboard] type query for inline boards failed", err);
      return inlineIdCache?.ids ?? [];
    } finally {
      inlineIdInflight = null;
    }
  })();
  return inlineIdInflight;
}

/** Keep a warm type-id cache in sync when a board is touched incrementally. */
export function rememberInlineBoardId(id: DbId): void {
  if (inlineIdCache == null) return;
  if (inlineIdCache.ids.includes(id)) return;
  inlineIdCache = {
    ids: [...inlineIdCache.ids, id],
    fetchedAt: inlineIdCache.fetchedAt,
  };
}

export async function ensureBlocksLoaded(ids: readonly DbId[]): Promise<void> {
  await loadMissingBlocks(ids);
}

let pageIdDiscover: { epoch: number; task: Promise<DbId[]> } | null = null;

async function discoverPageBoardIds(): Promise<DbId[]> {
  let aliasIds: DbId[] = [];
  try {
    aliasIds = await queryBlockIds({
      kind: 9,
      hasAliases: true,
    });
  } catch (err: unknown) {
    console.warn("[whiteboard] hasAliases query for page boards failed", err);
    return collectKnownPageBoardIds();
  }
  await loadMissingBlocks(aliasIds);
  const found = new Set<DbId>(collectKnownPageBoardIds());
  for (const id of aliasIds) {
    if (isPageWhiteboardBlock(orca.state.blocks[id])) found.add(id);
  }
  return [...found];
}

async function pageBoardIdsForList(now: number): Promise<DbId[]> {
  const cached = getFreshPageBoardIds(now);
  if (cached != null) return [...cached];
  const epoch = pageBoardCacheEpoch();
  if (pageIdDiscover != null && pageIdDiscover.epoch === epoch) {
    return pageIdDiscover.task;
  }
  const task = discoverPageBoardIds()
    .then((ids) => {
      storePageBoardIds(ids, Date.now(), epoch);
      return ids;
    })
    .catch((err: unknown) => {
      console.warn("[whiteboard] page-board id discover failed", err);
      return collectKnownPageBoardIds();
    })
    .finally(() => {
      if (pageIdDiscover?.task === task) pageIdDiscover = null;
    });
  pageIdDiscover = { epoch, task };
  return task;
}

function blocksForIds(ids: readonly DbId[]): Block[] {
  const byId = new Map<DbId, Block>();
  for (const id of ids) {
    const block = orca.state.blocks[id];
    if (block == null) continue;
    if (isInlineWhiteboardBlock(block) || isPageWhiteboardBlock(block)) {
      byId.set(id, block);
    }
  }
  return [...byId.values()];
}

/**
 * Inline boards via `_repr.type` (always live). Page boards via a TTL cache of
 * ids; QueryBlock has no custom-property field (query-types.md / QueryBlock2).
 */
export async function fetchWhiteboardBlocks(): Promise<Block[]> {
  const now = Date.now();
  let typeIds: DbId[] = [];
  try {
    typeIds = await inlineBoardIdsForList(now);
  } catch (err: unknown) {
    console.warn("[whiteboard] type query for inline boards failed", err);
  }

  let pageIds: DbId[] = [];
  try {
    pageIds = await pageBoardIdsForList(now);
  } catch (err: unknown) {
    console.warn("[whiteboard] page-board id list failed", err);
    pageIds = collectKnownPageBoardIds();
  }

  const ids = uniqueIds([
    ...typeIds,
    ...pageIds,
    ...collectKnownWhiteboardIds(),
  ]);
  if (ids.length === 0) return [];
  await loadMissingBlocks(ids);
  return blocksForIds(ids);
}

export function listBoards(blocks: readonly Block[]): BoardListItem[] {
  return blocks
    .map((block) => ({
      id: block.id,
      name: boardName(block),
      cardCount: readCards(block).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function findOpenBoardPanelId(
  root: RowPanel,
  boardId: DbId,
): string | null {
  const stack: Array<RowPanel | ColumnPanel | ViewPanel> = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node == null) continue;
    if ("view" in node) {
      if (
        node.view === PANEL_TYPE &&
        asBlockId(node.viewArgs?.blockId) === boardId
      ) {
        return node.id;
      }
      continue;
    }
    for (const child of node.children) stack.push(child);
  }
  return null;
}

export async function findBoardsContainingBlock(
  blockId: DbId,
): Promise<BoardLocateHit[]> {
  const boards = await fetchWhiteboardBlocks();
  const ancestors = await ancestorIds(blockId);
  const hits: BoardLocateHit[] = [];
  for (const board of boards) {
    const cards = readCards(board);
    let selfId: DbId | null = null;
    for (const card of cards) {
      if (card.blockId === blockId) {
        selfId = card.blockId;
        break;
      }
    }
    let ancestorId: DbId | null = null;
    if (selfId == null) {
      const cardIds = new Set(cards.map((card) => card.blockId));
      for (const ancestor of ancestors) {
        if (cardIds.has(ancestor)) {
          ancestorId = ancestor;
          break;
        }
      }
    }
    const cardBlockId = selfId ?? ancestorId;
    if (cardBlockId == null) continue;
    hits.push({
      boardId: board.id,
      name: boardName(board),
      cardBlockId,
      viaAncestor: selfId == null,
    });
  }
  return hits;
}

async function loadBlock(id: DbId): Promise<Block> {
  return orca.state.blocks[id] ?? fetchBlock(id);
}

async function ancestorIds(startId: DbId): Promise<DbId[]> {
  const seen = new Set<DbId>([startId]);
  const ids: DbId[] = [];
  let current = await loadBlock(startId);
  let parentId = current.parent;
  for (let i = 0; i < PARENT_WALK_LIMIT && parentId != null; i++) {
    if (seen.has(parentId)) break;
    seen.add(parentId);
    ids.push(parentId);
    current = await loadBlock(parentId);
    parentId = current.parent;
  }
  return ids;
}
