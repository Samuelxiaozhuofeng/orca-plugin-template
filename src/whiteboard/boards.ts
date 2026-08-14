import type {
  Block,
  ColumnPanel,
  DbId,
  RowPanel,
  ViewPanel,
} from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  boardName,
  PANEL_TYPE,
  readCards,
  WHITEBOARD_TYPE,
  type WhiteboardCard,
} from "./data";
import { fetchBlock } from "./newCard";

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

const openBoards = new Map<DbId, OpenBoard>();

export function registerOpenBoard(id: DbId, api: OpenBoard): () => void {
  openBoards.set(id, api);
  return () => {
    if (openBoards.get(id) === api) openBoards.delete(id);
  };
}

export function getOpenBoard(id: DbId): OpenBoard | null {
  return openBoards.get(id) ?? null;
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

function reprType(block: Block): string | null {
  const repr = block.properties?.find((item) => item.name === "_repr")?.value;
  if (repr == null || typeof repr !== "object") return null;
  const type = (repr as { type?: unknown }).type;
  return typeof type === "string" ? type : null;
}

export async function fetchWhiteboardBlocks(): Promise<Block[]> {
  const result = await orca.invokeBackend("query", {
    q: {
      kind: 1,
      conditions: [
        {
          kind: 9,
          types: { op: 5, value: [WHITEBOARD_TYPE] },
        },
      ],
    },
    pageSize: -1,
  });
  const ids = collectIds(result);
  if (ids.length === 0) return [];
  const fetched =
    ((await orca.invokeBackend("get-blocks", ids)) as Block[] | null) ?? [];
  if (!Array.isArray(fetched)) {
    throw new Error(t("Failed to list whiteboards"));
  }
  for (const block of fetched) {
    orca.state.blocks[block.id] = block;
  }
  return fetched.filter((block) => reprType(block) === WHITEBOARD_TYPE);
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
