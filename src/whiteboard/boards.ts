import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  boardName,
  readCards,
  WHITEBOARD_TYPE,
  type WhiteboardCard,
} from "./data";

export type BoardListItem = {
  id: DbId;
  name: string;
  cardCount: number;
};

type OpenBoard = {
  getCards: () => WhiteboardCard[];
  appendCards: (incoming: WhiteboardCard[]) => Promise<boolean>;
};

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
