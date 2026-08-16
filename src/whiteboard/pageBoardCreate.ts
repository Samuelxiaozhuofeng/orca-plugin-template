import type { Block, CursorData, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { tagNewWhiteboard } from "./boardTag";
import { insertedBlockId, openBoard } from "./data";
import { referenceFragments } from "./linkEdge";
import { createdBlockFromResult } from "./newCard";
import {
  createInlineRef,
  deleteBlockBestEffort,
  writeBlockContent,
} from "./noteWrite";
import { writePageWhiteboardFlag } from "./pageBoardFlag";
import { forgetPageBoardInCache } from "./pageBoardListCache";
import {
  asBlockId,
  isBlankPageName,
  normalizePageName,
  numberedAlias,
} from "./pageBoardPlan";

const ALIAS_ATTEMPTS = 99;

function aliasLookupHit(result: unknown): boolean {
  if (result == null) return false;
  if (typeof result === "number" && Number.isFinite(result)) return true;
  if (typeof result !== "object") return false;
  if ("id" in result && asBlockId((result as { id: unknown }).id) != null) {
    return true;
  }
  if ("id" in result && (result as { id: unknown }).id == null) return false;
  return true;
}

export async function aliasExists(name: string): Promise<boolean> {
  try {
    const byId = await orca.invokeBackend("get-blockid-by-alias", name);
    if (aliasLookupHit(byId)) return true;
  } catch (err: unknown) {
    console.warn("[whiteboard] get-blockid-by-alias failed", name, err);
  }
  try {
    const block = await orca.invokeBackend("get-block-by-alias", name);
    return aliasLookupHit(block);
  } catch (err: unknown) {
    console.warn("[whiteboard] get-block-by-alias failed", name, err);
    return false;
  }
}

function isCreateAliasError(result: unknown): boolean {
  if (result == null) return false;
  if (result instanceof Error) return true;
  if (typeof result !== "object") return false;
  const rec = result as { message?: unknown; error?: unknown; id?: unknown };
  if (asBlockId(rec.id) != null) return false;
  return rec.message != null || rec.error != null;
}

/** Exact name only — user-chosen titles are never auto-numbered. */
async function assignExactAlias(blockId: DbId, name: string): Promise<boolean> {
  try {
    const result = await orca.commands.invokeEditorCommand(
      "core.editor.createAlias",
      null,
      name,
      blockId,
      true,
    );
    if (isCreateAliasError(result)) return false;
    return true;
  } catch (err: unknown) {
    console.warn("[whiteboard] createAlias failed", name, err);
    return false;
  }
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

async function loadHostBlock(hostId: DbId): Promise<Block | null> {
  try {
    const loaded = (await orca.invokeBackend("get-block", hostId)) as
      | Block
      | null;
    if (loaded != null && typeof loaded.id === "number") {
      orca.state.blocks[loaded.id] = loaded;
      return loaded;
    }
  } catch (err: unknown) {
    console.warn("[whiteboard] failed to load host block", hostId, err);
  }
  return orca.state.blocks[hostId] ?? null;
}

/**
 * Put an `@`-style inline ref (`{ t: "r", v: refId }`) into the host body.
 * Prefer the live cursor; otherwise append so existing text is kept.
 */
async function insertInlinePageRef(
  pageId: DbId,
  hostId: DbId,
  cursor: CursorData | null,
): Promise<boolean> {
  if (hostId === pageId) return false;
  const refId = await createInlineRef(hostId, pageId);
  const fragments = referenceFragments(undefined, refId);

  const cursorHost = asBlockId(cursor?.anchor?.blockId);
  if (cursorHost === hostId && cursor?.anchor != null) {
    try {
      await orca.commands.invokeEditorCommand(
        "core.editor.insertFragments",
        cursor,
        fragments,
      );
      return true;
    } catch (err: unknown) {
      console.warn("[whiteboard] insertFragments page ref failed", err);
    }
  }

  const host = await loadHostBlock(hostId);
  const existing = Array.isArray(host?.content) ? [...host.content] : [];
  await writeBlockContent(hostId, [...existing, ...fragments]);
  return true;
}

export async function pickFreeAliasName(base: string): Promise<string> {
  const stem = normalizePageName(base) || t("Untitled whiteboard");
  for (let i = 1; i <= ALIAS_ATTEMPTS; i++) {
    const name = numberedAlias(stem, i);
    try {
      if (await aliasExists(name)) continue;
      return name;
    } catch (err: unknown) {
      console.warn("[whiteboard] alias probe failed", name, err);
      return name;
    }
  }
  return `${stem} ${Date.now()}`;
}

async function abandonNewPage(id: DbId): Promise<void> {
  forgetPageBoardInCache(id);
  await deleteBlockBestEffort(id);
}

export async function createWhiteboardPage(
  panelId: string,
  cursor: CursorData | null,
  name: string,
): Promise<DbId | null> {
  const pageName = normalizePageName(name);
  if (isBlankPageName(pageName)) {
    orca.notify("error", t("Failed to create whiteboard"));
    return null;
  }

  try {
    if (await aliasExists(pageName)) {
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
    newId = await insertRootTextPage(pageName, cursor);
  } catch (err: unknown) {
    console.error("[whiteboard] failed to insert whiteboard page", err);
  }
  if (newId == null) {
    orca.notify("error", t("Failed to create whiteboard"));
    return null;
  }

  try {
    await writePageWhiteboardFlag(newId, true);
  } catch (err: unknown) {
    console.error("[whiteboard] failed to mark new page as whiteboard", err);
    await abandonNewPage(newId);
    orca.notify("error", t("Failed to create whiteboard"));
    return null;
  }

  const aliased = await assignExactAlias(newId, pageName);
  if (!aliased) {
    await abandonNewPage(newId);
    orca.notify("error", t("Failed to create whiteboard"));
    return null;
  }

  const hostId = asBlockId(cursor?.anchor?.blockId);
  if (hostId != null && hostId !== newId) {
    try {
      const linked = await insertInlinePageRef(newId, hostId, cursor);
      if (!linked) {
        orca.notify(
          "warn",
          t(
            "Created the whiteboard but could not add a reference on the current block.",
          ),
        );
      }
    } catch (err: unknown) {
      console.warn("[whiteboard] page ref failed", err);
      orca.notify(
        "warn",
        t(
          "Created the whiteboard but could not add a reference on the current block.",
        ),
      );
    }
  }

  try {
    await tagNewWhiteboard(newId, cursor);
  } catch (err: unknown) {
    console.warn("[whiteboard] failed to tag new whiteboard page", err);
  }

  openBoard(newId, panelId, false);
  return newId;
}
