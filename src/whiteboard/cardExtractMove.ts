import type { Block, ContentFragment, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { createdBlockFromResult, fetchBlock } from "./newCard";
import {
  EXTRACT_FROM_PROP,
  EXTRACT_PROP_TYPE,
  EXTRACT_STUB_PROP,
  lastChildLeftId,
  originFromBlock,
  serializeExtractRestore,
  type ExtractRestoreInfo,
} from "./cardExtractModel";
import {
  cacheReturnedBlocks,
  createInlineRef,
  deleteBlockBestEffort,
  writeBlockContent,
} from "./noteWrite";

export {
  canRestoreExtract,
  EXTRACT_FROM_PROP,
  EXTRACT_STUB_PROP,
  lastChildLeftId,
  originFromBlock,
  parseExtractRestore,
  planRestoreAnchor,
  readExtractRestore,
  serializeExtractRestore,
  type ExtractRestoreInfo,
} from "./cardExtractModel";

function referenceFragments(refId: DbId): ContentFragment[] {
  return [{ t: "r", v: refId }];
}

function cacheMovedBlocks(result: unknown): DbId[] {
  const blocks = Array.isArray(result) ? result[0] : null;
  if (!Array.isArray(blocks)) return [];
  const ids: DbId[] = [];
  for (const item of blocks) {
    if (item == null || typeof item !== "object" || !("id" in item)) continue;
    const block = item as Block;
    if (typeof block.id !== "number") continue;
    orca.state.blocks[block.id] = block;
    ids.push(block.id);
  }
  return ids;
}

export async function moveBlocksTo(
  ids: readonly DbId[],
  parentId: DbId,
  leftId: DbId | null,
): Promise<void> {
  if (ids.length === 0) return;
  const result = await orca.invokeBackend(
    "move-blocks",
    [...ids],
    parentId,
    leftId,
    {},
  );
  const refreshed = cacheMovedBlocks(result);
  const extra = [parentId, ...ids].filter((id) => !refreshed.includes(id));
  for (const id of extra) {
    try {
      await fetchBlock(id);
    } catch {
      // still broadcast so the host can refill
    }
  }
  orca.broadcasts.broadcast("orca.refresh-blocks", [...refreshed, ...extra]);
}

async function insertTextBlockAt(
  parentId: DbId,
  leftId: DbId | null,
): Promise<Block> {
  const result = await orca.invokeBackend(
    "create-block",
    parentId,
    leftId,
    null,
    null,
    { type: "text" },
  );
  const created = createdBlockFromResult(result);
  orca.broadcasts.broadcast("orca.refresh-blocks", [parentId, created.id]);
  return created;
}

async function setTextProp(
  blockId: DbId,
  name: string,
  value: string,
): Promise<void> {
  const result = await orca.invokeBackend("set-properties", [blockId], [
    { name, type: EXTRACT_PROP_TYPE, value },
  ]);
  cacheReturnedBlocks(result);
  try {
    await fetchBlock(blockId);
  } catch {
    // cached result above is enough to keep going
  }
  orca.broadcasts.broadcast("orca.refresh-blocks", [blockId]);
}

export async function deleteTextPropBestEffort(
  blockId: DbId,
  name: string,
): Promise<void> {
  try {
    const result = await orca.invokeBackend("delete-properties", [blockId], [
      name,
    ]);
    cacheReturnedBlocks(result);
    orca.broadcasts.broadcast("orca.refresh-blocks", [blockId]);
  } catch (error) {
    console.error(
      "[whiteboard] failed to remove extract property",
      blockId,
      name,
      error,
    );
  }
}

async function createExtractStub(opts: {
  parentId: DbId;
  leftId: DbId | null;
  movedId: DbId;
  sourceCardId: DbId | null;
}): Promise<DbId> {
  const stub = await insertTextBlockAt(opts.parentId, opts.leftId);
  try {
    const refId = await createInlineRef(stub.id, opts.movedId);
    // Same order as linkEdge.ts: the plain-text mirror is derived from the
    // block's refs, so read the ref back before converting the content.
    await fetchBlock(stub.id);
    await writeBlockContent(stub.id, referenceFragments(refId));
    await setTextProp(
      stub.id,
      EXTRACT_STUB_PROP,
      JSON.stringify({
        to: opts.movedId,
        source: opts.sourceCardId,
      }),
    );
    return stub.id;
  } catch (error) {
    await deleteBlockBestEffort(stub.id);
    throw error;
  }
}

export async function moveBlockOutAsExtract(opts: {
  blockId: DbId;
  sourceCardId: DbId | null;
  boardBlockId: DbId;
}): Promise<ExtractRestoreInfo> {
  if (opts.blockId === opts.boardBlockId) {
    throw new Error(t("Failed to extract this block from the note"));
  }
  const block = await fetchBlock(opts.blockId);
  const origin = originFromBlock(block);
  if (origin == null) {
    throw new Error(t("Failed to extract this block from the note"));
  }
  const board = await fetchBlock(opts.boardBlockId);
  const left = lastChildLeftId(board.children ?? [], new Set([opts.blockId]));
  await moveBlocksTo([opts.blockId], opts.boardBlockId, left);
  let stubId: DbId | null = null;
  try {
    stubId = await createExtractStub({
      parentId: origin.originParentId,
      leftId: origin.originLeftId,
      movedId: opts.blockId,
      sourceCardId: opts.sourceCardId,
    });
    const info: ExtractRestoreInfo = {
      movedId: opts.blockId,
      sourceCardId: opts.sourceCardId,
      originParentId: origin.originParentId,
      originLeftId: origin.originLeftId,
      stubId,
      boardBlockId: opts.boardBlockId,
    };
    await setTextProp(
      opts.blockId,
      EXTRACT_FROM_PROP,
      serializeExtractRestore(info),
    );
    return info;
  } catch (error) {
    if (stubId != null) await deleteBlockBestEffort(stubId);
    try {
      await moveBlocksTo(
        [opts.blockId],
        origin.originParentId,
        origin.originLeftId,
      );
    } catch (rollbackError) {
      console.error("[whiteboard] failed to roll back extract move", rollbackError);
    }
    throw error;
  }
}
