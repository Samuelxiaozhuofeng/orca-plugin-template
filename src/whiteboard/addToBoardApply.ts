import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  getOpenOrSessionBoard,
  type OpenBoard,
} from "./boards";
import {
  boardPropsReadable,
  formatProtectMessage,
  loadBoardBlock,
  notifyBoardUnreadable,
} from "./boardWrite";
import { tryReadCards } from "./cards";
import { openBoard, readCards, writeCards } from "./data";
import {
  originBelowCards,
  placeDroppedBlocks,
  type DropBlocksResult,
} from "./dropBlocks";
import { tryReadEdges } from "./edges";
import { fetchBlock } from "./newCard";
import {
  collectQueryResultIds,
  hasQueryGroup,
  isQueryBlock,
  planQueryToBoardCards,
  QUERY_TO_BOARD_LIMIT,
  queryBackendPayload,
  queryDescriptionFromBlock,
  type QueryToBoardPlan,
} from "./queryToBoard";
import {
  collectTaggedBlockIds,
  planTagToBoardCards,
  TAG_TO_BOARD_LIMIT,
  tagNameFromBlock,
  type TagToBoardPlan,
} from "./tagToBoard";

export type ApplyOutcome<T> = T & { refused: boolean };

type BoardTarget = {
  live: OpenBoard | null;
  cards: ReturnType<typeof readCards>;
};

async function loadBoardTarget(boardId: DbId): Promise<BoardTarget> {
  const live = getOpenOrSessionBoard(boardId);
  if (live != null) return { live, cards: live.getCards() };
  const block = (await loadBoardBlock(boardId)) ?? (await fetchBlock(boardId));
  return { live: null, cards: readCards(block) };
}

async function loadWritableBoardTarget(boardId: DbId): Promise<BoardTarget> {
  const live = getOpenOrSessionBoard(boardId);
  if (live != null) return { live, cards: live.getCards() };
  const block = (await loadBoardBlock(boardId)) ?? (await fetchBlock(boardId));
  if (!boardPropsReadable(block)) {
    notifyBoardUnreadable(boardId);
    throw new Error(
      formatProtectMessage(tryReadCards(block), tryReadEdges(block)),
    );
  }
  const parsed = tryReadCards(block);
  return { live: null, cards: parsed.ok ? parsed.value : [] };
}

async function commitIncoming(
  boardId: DbId,
  target: BoardTarget,
  incoming: BoardTarget["cards"],
): Promise<boolean> {
  if (incoming.length === 0) return true;
  if (target.live != null) {
    return target.live.appendCards(incoming);
  }
  await writeCards(boardId, [...target.cards, ...incoming]);
  return true;
}

export function boardOpenAction(boardId: DbId): () => void {
  return () => openBoard(boardId, orca.state.activePanel, false);
}

export async function addBlocksToBoard(
  boardId: DbId,
  ids: readonly DbId[],
): Promise<ApplyOutcome<DropBlocksResult>> {
  const target = await loadBoardTarget(boardId);
  const result = await placeDroppedBlocks({
    ids,
    at: originBelowCards(target.cards),
    existing: target.cards,
    boardBlockId: boardId,
  });
  if (result.added === 0) return { ...result, refused: false };
  const saved = await commitIncoming(boardId, target, result.incoming);
  if (!saved) return { ...result, refused: true };
  return { ...result, refused: false };
}

function cacheTaggedBlocks(result: unknown): void {
  if (!Array.isArray(result)) return;
  for (const item of result) {
    if (item == null || typeof item !== "object" || !("id" in item)) continue;
    const block = item as Block;
    if (typeof block.id === "number") orca.state.blocks[block.id] = block;
  }
}

async function fetchTaggedBlockIds(tagName: string): Promise<DbId[]> {
  const result = await orca.invokeBackend("get-blocks-with-tags", [tagName]);
  cacheTaggedBlocks(result);
  return collectTaggedBlockIds(result);
}

/** Add card pointers for a tag. Never moves, copies, or deletes note content. */
export async function spreadTagOntoBoard(
  boardId: DbId,
  tagBlock: { id: DbId; aliases?: readonly string[]; text?: string },
): Promise<ApplyOutcome<TagToBoardPlan>> {
  const tagName = tagNameFromBlock(tagBlock);
  if (tagName == null) {
    throw new Error(t("This tag has no name"));
  }
  const target = await loadWritableBoardTarget(boardId);
  const ids = await fetchTaggedBlockIds(tagName);
  const plan = planTagToBoardCards({
    blockIds: ids,
    existing: target.cards,
    limit: TAG_TO_BOARD_LIMIT,
    boardBlockId: boardId,
  });
  if (plan.incoming.length === 0) return { ...plan, refused: false };
  const saved = await commitIncoming(boardId, target, plan.incoming);
  if (!saved) return { ...plan, refused: true };
  return { ...plan, refused: false };
}

function cacheQueryResultBlocks(result: unknown): void {
  if (!Array.isArray(result)) return;
  for (const item of result) {
    if (item == null || typeof item !== "object" || !("id" in item)) continue;
    const block = item as Block;
    if (typeof block.id === "number") orca.state.blocks[block.id] = block;
  }
}

async function fetchQueryResultIds(queryBlock: Block): Promise<DbId[]> {
  const desc = queryDescriptionFromBlock(queryBlock);
  if (desc == null) {
    throw new Error(t("This query has no conditions"));
  }
  if (!hasQueryGroup(desc)) {
    throw new Error(t("This query has no conditions"));
  }
  const result = await orca.invokeBackend(
    "query",
    queryBackendPayload(desc, queryBlock.id),
  );
  cacheQueryResultBlocks(result);
  return collectQueryResultIds(result);
}

/** Add card pointers for a query's current hits. Never moves or copies notes. */
export async function spreadQueryOntoBoard(
  boardId: DbId,
  queryBlockId: DbId,
): Promise<ApplyOutcome<QueryToBoardPlan>> {
  let queryBlock = orca.state.blocks[queryBlockId];
  if (queryBlock == null) queryBlock = await fetchBlock(queryBlockId);
  if (!isQueryBlock(queryBlock)) {
    throw new Error(t("This is not a query block"));
  }
  const desc = queryDescriptionFromBlock(queryBlock);
  if (desc == null || !hasQueryGroup(desc)) {
    throw new Error(t("This query has no conditions"));
  }

  const target = await loadWritableBoardTarget(boardId);
  const ids = await fetchQueryResultIds(queryBlock);
  const plan = planQueryToBoardCards({
    blockIds: ids,
    existing: target.cards,
    limit: QUERY_TO_BOARD_LIMIT,
    boardBlockId: boardId,
  });
  if (plan.incoming.length === 0) return { ...plan, refused: false };
  const saved = await commitIncoming(boardId, target, plan.incoming);
  if (!saved) return { ...plan, refused: true };
  return { ...plan, refused: false };
}
