import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";

const CARDS_PROP = "cards";
const EDGES_PROP = "edges";

export const BOARD_UNREADABLE_MSG =
  "This whiteboard's data could not be read. Saving has been stopped so nothing is overwritten.";

const protectTold = new Set<DbId>();

export function notifyBoardUnreadable(boardId: DbId): void {
  if (protectTold.has(boardId)) return;
  protectTold.add(boardId);
  orca.notify("error", t(BOARD_UNREADABLE_MSG));
}

/** True when a stored cards/edges property is missing, empty, or a JSON array. */
export function isJsonArrayProp(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return true;
    try {
      return Array.isArray(JSON.parse(trimmed));
    } catch {
      return false;
    }
  }
  return Array.isArray(value);
}

function propValue(
  block:
    | { properties?: readonly { name: string; value?: unknown }[] }
    | null
    | undefined,
  name: string,
): unknown {
  return block?.properties?.find((item) => item.name === name)?.value;
}

export async function loadBoardBlock(blockId: DbId): Promise<Block | null> {
  const cached = orca.state.blocks[blockId];
  if (cached != null) return cached;
  const fresh = (await orca.invokeBackend("get-block", blockId)) as
    | Block
    | null;
  if (fresh != null && typeof fresh.id === "number") {
    orca.state.blocks[fresh.id] = fresh;
  }
  return fresh;
}

export function boardPropsReadable(
  block:
    | { properties?: readonly { name: string; value?: unknown }[] }
    | null
    | undefined,
): boolean {
  if (block == null) return true;
  return (
    isJsonArrayProp(propValue(block, CARDS_PROP)) &&
    isJsonArrayProp(propValue(block, EDGES_PROP))
  );
}

export async function assertBoardWritable(blockId: DbId): Promise<void> {
  const block = await loadBoardBlock(blockId);
  if (boardPropsReadable(block)) return;
  notifyBoardUnreadable(blockId);
  throw new Error(t(BOARD_UNREADABLE_MSG));
}

function applyReturnedBlocks(result: unknown): void {
  const blocks = Array.isArray(result)
    ? Array.isArray(result[1])
      ? result[1]
      : result
    : [];
  for (const item of blocks) {
    if (item != null && typeof item === "object" && "id" in item) {
      const next = item as Block;
      if (typeof next.id === "number") {
        orca.state.blocks[next.id] = next;
      }
    }
  }
}

export async function writeProperties(
  blockId: DbId,
  props: Array<{ name: string; type: number; value: string }>,
): Promise<Block | null> {
  if (props.length === 0) {
    return orca.state.blocks[blockId] ?? null;
  }
  const result = await orca.invokeBackend("set-properties", [blockId], props);
  applyReturnedBlocks(result);
  const fresh = (await orca.invokeBackend("get-block", blockId)) as
    | Block
    | null;
  if (fresh != null && typeof fresh.id === "number") {
    orca.state.blocks[fresh.id] = fresh;
  }
  orca.broadcasts.broadcast("orca.refresh-blocks", [blockId]);
  return fresh ?? orca.state.blocks[blockId] ?? null;
}
