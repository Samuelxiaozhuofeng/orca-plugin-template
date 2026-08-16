import type { Block, CursorData, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { tagNewWhiteboard } from "./boardTag";
import { insertedBlockId } from "./data";
import {
  createdBlockFromResult,
  insertLastChildTextBlock,
} from "./newCard";
import { deleteBlockBestEffort, writeBlockContent } from "./noteWrite";
import { writeBlockRepr } from "./pageBoard";
import { aliasExists } from "./pageBoardCreate";
import { writePageWhiteboardFlag } from "./pageBoardFlag";
import { forgetPageBoardInCache } from "./pageBoardListCache";
import {
  asBlockId,
  isBlankPageName,
  normalizePageName,
} from "./pageBoardPlan";

export type SubBoardKind = "page" | "block";

export const PAGE_FROM_CANVAS_FAIL_MSG =
  'Could not create a whiteboard page from the canvas. Create it with the "New whiteboard page" command, then drag it onto this board.';

/**
 * Backend `create-alias` (asar 1.88: main `ve.CreateAlias` → `createAlias`,
 * args `name, blockId, asPage, pos`). `core.editor.createAlias` is only a
 * wrapper around this same call, and the editor-command dispatcher returns
 * undefined when the active panel has no `viewState.editor` — which is always
 * true for the whiteboard canvas. So go to the backend directly.
 * Returns "" on success, "DuplicateAlias" / "BadAlias" on failure.
 */
async function assignExactAlias(blockId: DbId, name: string): Promise<boolean> {
  try {
    const result = await orca.invokeBackend(
      "create-alias",
      name,
      blockId,
      true,
    );
    if (typeof result === "string" && result !== "") {
      console.warn("[whiteboard] create-alias refused", name, result);
      return false;
    }
    // The editor command would refresh state for us; the backend will not.
    orca.broadcasts.broadcast("orca.refresh-blocks", [blockId]);
    return true;
  } catch (err: unknown) {
    console.warn("[whiteboard] create-alias failed", name, err);
    return false;
  }
}

function aliasesOf(block: { aliases?: unknown } | null | undefined): string[] {
  if (!Array.isArray(block?.aliases)) return [];
  return block.aliases.filter((item): item is string => typeof item === "string");
}

/** createAlias can no-op without an editor — only a read-back counts. */
async function aliasLanded(blockId: DbId, name: string): Promise<boolean> {
  try {
    const fresh = (await orca.invokeBackend("get-block", blockId)) as
      | Block
      | null;
    if (fresh != null && typeof fresh.id === "number") {
      orca.state.blocks[fresh.id] = fresh;
      if (aliasesOf(fresh).includes(name)) return true;
    }
  } catch (err: unknown) {
    console.warn("[whiteboard] get-block after createAlias failed", err);
  }
  try {
    const byId = await orca.invokeBackend("get-blockid-by-alias", name);
    if (asBlockId(byId) === blockId) return true;
    if (byId != null && typeof byId === "object" && "id" in byId) {
      return asBlockId((byId as { id: unknown }).id) === blockId;
    }
  } catch (err: unknown) {
    console.warn("[whiteboard] get-blockid-by-alias after createAlias failed", err);
  }
  return false;
}

async function insertRootTextPage(
  name: string,
  cursor: CursorData | null,
): Promise<DbId | null> {
  try {
    const inserted = await orca.commands.invokeEditorCommand(
      "core.editor.insertBlock",
      cursor,
      null,
      null,
      [{ t: "t", v: name }],
      { type: "text" },
    );
    const id = insertedBlockId(inserted);
    if (id != null) return id;
  } catch (err: unknown) {
    console.warn("[whiteboard] insertBlock at root failed", err);
  }

  try {
    const result = await orca.invokeBackend(
      "create-block",
      null,
      null,
      null,
      null,
      { type: "text" },
    );
    const created = createdBlockFromResult(result);
    try {
      await writeBlockContent(created.id, [{ t: "t", v: name }]);
    } catch (err: unknown) {
      console.warn("[whiteboard] failed to set new page title", err);
    }
    return created.id;
  } catch (err: unknown) {
    console.warn("[whiteboard] create-block at root failed", err);
    return null;
  }
}

export async function abandonNewSubBoard(id: DbId): Promise<void> {
  forgetPageBoardInCache(id);
  await deleteBlockBestEffort(id);
}

async function tagBestEffort(id: DbId): Promise<void> {
  try {
    await tagNewWhiteboard(id, null);
  } catch (err: unknown) {
    console.warn("[whiteboard] failed to tag new sub-board", err);
  }
}

async function createBlockSubBoard(
  name: string,
  parentBoardId: DbId,
): Promise<DbId | null> {
  let createdId: DbId | null = null;
  try {
    const created = await insertLastChildTextBlock(parentBoardId);
    createdId = created.id;
    try {
      await writeBlockContent(created.id, [{ t: "t", v: name }]);
    } catch (err: unknown) {
      console.warn("[whiteboard] failed to name new sub-board block", err);
    }
    await writeBlockRepr(created.id, { type: "whiteboard.canvas" });
    await tagBestEffort(created.id);
    return created.id;
  } catch (err: unknown) {
    console.error("[whiteboard] failed to create block sub-board", err);
    if (createdId != null) await abandonNewSubBoard(createdId);
    orca.notify(
      "error",
      err instanceof Error ? err.message : t("Failed to create whiteboard"),
    );
    return null;
  }
}

async function createPageSubBoard(name: string): Promise<DbId | null> {
  try {
    if (await aliasExists(name)) {
      orca.notify(
        "error",
        t("A page with this name already exists. Choose another name."),
      );
      return null;
    }
  } catch (err: unknown) {
    console.warn("[whiteboard] alias probe failed", err);
  }

  let newId: DbId | null = null;
  try {
    newId = await insertRootTextPage(name, null);
  } catch (err: unknown) {
    console.error("[whiteboard] failed to insert sub-board page", err);
  }
  if (newId == null) {
    orca.notify("error", t("Failed to create whiteboard"));
    return null;
  }

  try {
    await writePageWhiteboardFlag(newId, true);
  } catch (err: unknown) {
    console.error("[whiteboard] failed to mark sub-board page", err);
    await abandonNewSubBoard(newId);
    orca.notify(
      "error",
      err instanceof Error ? err.message : t("Failed to create whiteboard"),
    );
    return null;
  }

  // Canvas panels have no viewState.editor, so createAlias often no-ops.
  // Only a read-back of aliases (or alias→id) counts as success.
  const aliased = (await assignExactAlias(newId, name)) && (await aliasLanded(newId, name));
  if (!aliased) {
    await abandonNewSubBoard(newId);
    orca.notify("error", t(PAGE_FROM_CANVAS_FAIL_MSG));
    return null;
  }

  await tagBestEffort(newId);
  return newId;
}

/** Create a nested whiteboard and stay put. Never opens the new board. */
export async function createSubBoard(opts: {
  name: string;
  kind: SubBoardKind;
  parentBoardId: DbId;
}): Promise<DbId | null> {
  const name = normalizePageName(opts.name);
  if (isBlankPageName(name)) {
    orca.notify("error", t("Failed to create whiteboard"));
    return null;
  }
  if (opts.kind === "block") {
    return createBlockSubBoard(name, opts.parentBoardId);
  }
  return createPageSubBoard(name);
}
