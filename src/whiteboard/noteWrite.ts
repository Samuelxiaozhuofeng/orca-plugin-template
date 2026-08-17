import type { Block, ContentFragment, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { REF_TYPE_INLINE } from "./edgeRefs";
import { cacheBlockList } from "./newCard";

function asDbId(value: unknown): DbId | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Backend writes answer with `[changed, affected]`; keep the cache in sync. */
export function cacheReturnedBlocks(result: unknown): void {
  if (Array.isArray(result)) cacheBlockList(result[1]);
}

export async function writeBlockContent(
  blockId: DbId,
  content: ContentFragment[],
): Promise<void> {
  const block = orca.state.blocks[blockId] as Block | undefined;
  const text = await orca.converters.blockConvert(
    "plain",
    { content },
    { type: "text" },
    block,
  );
  const result = await orca.invokeBackend("set-blocks-content", [
    {
      id: blockId,
      content,
      text,
      modified: new Date(),
    },
  ]);
  cacheReturnedBlocks(result);
  orca.broadcasts.broadcast("orca.refresh-blocks", [blockId]);
}

export async function createInlineRef(
  fromId: DbId,
  toId: DbId,
  alias?: string,
): Promise<DbId> {
  const result = await orca.invokeBackend(
    "create-ref",
    fromId,
    toId,
    REF_TYPE_INLINE,
    alias,
  );
  const refId = asDbId(Array.isArray(result) ? result[0] : result);
  if (refId == null) {
    throw new Error(t("Failed to create a note reference"));
  }
  cacheReturnedBlocks(result);
  orca.broadcasts.broadcast("orca.refresh-blocks", [fromId, toId]);
  return refId;
}

export async function deleteBlockBestEffort(id: DbId): Promise<void> {
  try {
    const result = await orca.invokeBackend("delete-blocks", [id]);
    cacheReturnedBlocks(result);
    delete orca.state.blocks[id];
    orca.broadcasts.broadcast("orca.delete-blocks", [id]);
    orca.broadcasts.broadcast("orca.refresh-blocks", [id]);
  } catch (error) {
    console.error("[whiteboard] failed to delete leftover block", id, error);
  }
}
