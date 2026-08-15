import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n.ts";
import { tryReadAreas } from "./areas.ts";
import { emitBoardCardsChanged } from "./boardEvents.ts";
import { tryReadCards, type JsonParseResult } from "./cards.ts";
import { tryReadEdges } from "./edges.ts";

const CARDS_PROP = "cards";

export const BOARD_UNREADABLE_MSG =
  "This whiteboard's data could not be read. Saving has been stopped so nothing is overwritten. Changes you make now will not be kept.";

const CARDS_DROPPED_MSG =
  "${count} cards could not be read. Saving has been stopped so nothing is overwritten. Changes you make now will not be kept.";
const EDGES_DROPPED_MSG =
  "${count} connections could not be read. Saving has been stopped so nothing is overwritten. Changes you make now will not be kept.";
const AREAS_DROPPED_MSG =
  "${count} sections could not be read. Saving has been stopped so nothing is overwritten. Changes you make now will not be kept.";
const BOTH_DROPPED_MSG =
  "${cards} cards and ${edges} connections could not be read. Saving has been stopped so nothing is overwritten. Changes you make now will not be kept.";
const CARDS_AREAS_DROPPED_MSG =
  "${cards} cards and ${areas} sections could not be read. Saving has been stopped so nothing is overwritten. Changes you make now will not be kept.";
const EDGES_AREAS_DROPPED_MSG =
  "${edges} connections and ${areas} sections could not be read. Saving has been stopped so nothing is overwritten. Changes you make now will not be kept.";
const ALL_DROPPED_MSG =
  "${cards} cards, ${edges} connections and ${areas} sections could not be read. Saving has been stopped so nothing is overwritten. Changes you make now will not be kept.";

const protectTold = new Set<DbId>();

export type BoardWritePayload = {
  blockId: DbId;
  props: Array<{ name: string; type: number; value: string }>;
};

const lastWrites = new Map<DbId, BoardWritePayload>();

export function peekLastBoardWrite(
  blockId: DbId,
): BoardWritePayload | undefined {
  return lastWrites.get(blockId);
}

function droppedCount(read: JsonParseResult<unknown> | undefined): number {
  if (read == null || read.ok) return 0;
  return read.reason === "bad-items" ? read.dropped : 0;
}

export function formatProtectMessage(
  cardsRead: JsonParseResult<unknown>,
  edgesRead: JsonParseResult<unknown>,
  areasRead?: JsonParseResult<unknown>,
): string {
  const cardsDropped = droppedCount(cardsRead);
  const edgesDropped = droppedCount(edgesRead);
  const areasDropped = droppedCount(areasRead);
  if (cardsDropped > 0 && edgesDropped > 0 && areasDropped > 0) {
    return t(ALL_DROPPED_MSG, {
      cards: String(cardsDropped),
      edges: String(edgesDropped),
      areas: String(areasDropped),
    });
  }
  if (cardsDropped > 0 && areasDropped > 0) {
    return t(CARDS_AREAS_DROPPED_MSG, {
      cards: String(cardsDropped),
      areas: String(areasDropped),
    });
  }
  if (edgesDropped > 0 && areasDropped > 0) {
    return t(EDGES_AREAS_DROPPED_MSG, {
      edges: String(edgesDropped),
      areas: String(areasDropped),
    });
  }
  if (cardsDropped > 0 && edgesDropped > 0) {
    return t(BOTH_DROPPED_MSG, {
      cards: String(cardsDropped),
      edges: String(edgesDropped),
    });
  }
  if (cardsDropped > 0) {
    return t(CARDS_DROPPED_MSG, { count: String(cardsDropped) });
  }
  if (edgesDropped > 0) {
    return t(EDGES_DROPPED_MSG, { count: String(edgesDropped) });
  }
  if (areasDropped > 0) {
    return t(AREAS_DROPPED_MSG, { count: String(areasDropped) });
  }
  return t(BOARD_UNREADABLE_MSG);
}

export function notifyBoardUnreadable(boardId: DbId): void {
  if (protectTold.has(boardId)) return;
  protectTold.add(boardId);
  const block = orca.state.blocks[boardId];
  const cardsRead = tryReadCards(block);
  const edgesRead = tryReadEdges(block);
  const areasRead = tryReadAreas(block);
  const message =
    !cardsRead.ok || !edgesRead.ok || !areasRead.ok
      ? formatProtectMessage(cardsRead, edgesRead, areasRead)
      : t(BOARD_UNREADABLE_MSG);
  orca.notify("error", message);
}

export function clearBoardProtectTold(boardId: DbId): void {
  protectTold.delete(boardId);
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
    tryReadCards(block).ok && tryReadEdges(block).ok && tryReadAreas(block).ok
  );
}

export async function assertBoardWritable(blockId: DbId): Promise<void> {
  const block = await loadBoardBlock(blockId);
  if (boardPropsReadable(block)) return;
  notifyBoardUnreadable(blockId);
  const cardsRead = tryReadCards(block ?? undefined);
  const edgesRead = tryReadEdges(block ?? undefined);
  const areasRead = tryReadAreas(block ?? undefined);
  throw new Error(formatProtectMessage(cardsRead, edgesRead, areasRead));
}

export async function retryBoardWrite(
  payload: BoardWritePayload | null | undefined,
): Promise<void> {
  if (payload == null) return;
  await assertBoardWritable(payload.blockId);
  await writeProperties(payload.blockId, payload.props);
  if (payload.props.some((prop) => prop.name === CARDS_PROP)) {
    emitBoardCardsChanged(payload.blockId);
  }
}

export async function retryLastBoardWrite(blockId: DbId): Promise<void> {
  await retryBoardWrite(lastWrites.get(blockId));
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
  lastWrites.set(blockId, { blockId, props: props.slice() });
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
