import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  forgetPageBoardInCache,
  rememberPageBoardInCache,
} from "./pageBoardListCache";
import {
  isPageWhiteboardBlock,
  WHITEBOARD_PAGE_PROP,
} from "./pageBoardPlan";

/** PropType.Boolean — plugin-docs/constants/db.md */
const PROP_TYPE_BOOLEAN = 4;

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

async function refreshBlock(blockId: DbId): Promise<Block | null> {
  const fresh = (await orca.invokeBackend("get-block", blockId)) as
    | Block
    | null;
  if (fresh != null && typeof fresh.id === "number") {
    orca.state.blocks[fresh.id] = fresh;
  }
  orca.broadcasts.broadcast("orca.refresh-blocks", [blockId]);
  return fresh ?? orca.state.blocks[blockId] ?? null;
}

export async function writePageWhiteboardFlag(
  blockId: DbId,
  enabled: boolean,
): Promise<Block | null> {
  const result = await orca.invokeBackend(
    "set-properties",
    [blockId],
    [{ name: WHITEBOARD_PAGE_PROP, type: PROP_TYPE_BOOLEAN, value: enabled }],
  );
  applyReturnedBlocks(result);
  const verified = await refreshBlock(blockId);
  if (isPageWhiteboardBlock(verified) !== enabled) {
    throw new Error(
      enabled
        ? t("Failed to mark this page as a whiteboard")
        : t("Failed to turn this whiteboard back into an outline"),
    );
  }
  if (enabled) rememberPageBoardInCache(blockId);
  else forgetPageBoardInCache(blockId);
  return verified;
}

/**
 * Drop the page-whiteboard marker.
 * Prefers backend `delete-properties` (asar: DeleteProperties, same args as
 * core.editor.deleteProperties). Falls back to writing false if delete fails.
 */
export async function clearPageWhiteboardFlag(
  blockId: DbId,
): Promise<Block | null> {
  try {
    const result = await orca.invokeBackend(
      "delete-properties",
      [blockId],
      [WHITEBOARD_PAGE_PROP],
    );
    applyReturnedBlocks(result);
  } catch (err: unknown) {
    console.warn(
      "[whiteboard] delete-properties failed, setting whiteboardPage=false",
      err,
    );
    return writePageWhiteboardFlag(blockId, false);
  }
  const verified = await refreshBlock(blockId);
  if (!isPageWhiteboardBlock(verified)) {
    forgetPageBoardInCache(blockId);
    return verified;
  }
  console.warn(
    "[whiteboard] delete-properties left the page flag on; setting false",
  );
  return writePageWhiteboardFlag(blockId, false);
}
