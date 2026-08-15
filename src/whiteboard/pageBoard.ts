import type { Block, CursorData, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { tagNewWhiteboard } from "./boardTag";
import { loadBoardBlock, notifyBoardUnreadable } from "./boardWrite";
import { tryReadCards, writeCards } from "./cards";
import { insertedBlockId, openBoard, PANEL_TYPE } from "./data";
import { createdBlockFromResult } from "./newCard";
import { writeBlockContent } from "./noteWrite";
import { clearPageWhiteboardFlag, writePageWhiteboardFlag } from "./pageBoardFlag";
import {
  asBlockId,
  isInlineWhiteboardBlock,
  isPageWhiteboardBlock,
  isWhiteboardBlock,
  numberedAlias,
  panelIsBlockViewRoot,
  planTurnIntoCards,
  REPR_PROP,
  reprType,
} from "./pageBoardPlan";
import { suppressOutlineRedirect } from "./pageBoardRedirect";

export {
  asBlockId,
  isInlineWhiteboardBlock,
  isPageWhiteboardBlock,
  isWhiteboardBlock,
  numberedAlias,
  PAGE_BOARD_COLUMNS,
  panelIsBlockViewRoot,
  planChildCards,
  WHITEBOARD_PAGE_PROP,
  reprType,
} from "./pageBoardPlan";

const PROP_TYPE_JSON = 0;
const ALIAS_ATTEMPTS = 99;

export function isPanelBlockViewRoot(panelId: string, blockId: DbId): boolean {
  try {
    const panel = orca.nav.findViewPanel(panelId, orca.state.panels);
    return panelIsBlockViewRoot(panel, blockId);
  } catch (err: unknown) {
    console.warn("[whiteboard] findViewPanel failed", err);
    return false;
  }
}

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

export async function assignPageAlias(
  blockId: DbId,
  preferred: string,
): Promise<string | null> {
  const base = preferred.trim() || t("Untitled whiteboard");
  for (let i = 1; i <= ALIAS_ATTEMPTS; i++) {
    const name = numberedAlias(base, i);
    try {
      if (await aliasExists(name)) continue;
    } catch {
      // Probe failed: still try createAlias.
    }
    try {
      const result = await orca.commands.invokeEditorCommand(
        "core.editor.createAlias",
        null,
        name,
        blockId,
        true,
      );
      if (isCreateAliasError(result)) continue;
      return name;
    } catch (err: unknown) {
      console.warn("[whiteboard] createAlias failed", name, err);
    }
  }
  return null;
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

export async function writeBlockRepr(
  blockId: DbId,
  repr: { type: string },
): Promise<Block | null> {
  const result = await orca.invokeBackend(
    "set-properties",
    [blockId],
    [{ name: REPR_PROP, type: PROP_TYPE_JSON, value: repr }],
  );
  applyReturnedBlocks(result);
  const fresh = (await orca.invokeBackend("get-block", blockId)) as
    | Block
    | null;
  if (fresh != null && typeof fresh.id === "number") {
    orca.state.blocks[fresh.id] = fresh;
  }
  orca.broadcasts.broadcast("orca.refresh-blocks", [blockId]);
  const verified = fresh ?? orca.state.blocks[blockId] ?? null;
  if (reprType(verified) !== repr.type) {
    throw new Error(t("Failed to change this block's type"));
  }
  return verified;
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

async function pickFreeAliasName(base: string): Promise<string> {
  for (let i = 1; i <= ALIAS_ATTEMPTS; i++) {
    const name = numberedAlias(base, i);
    if (!(await aliasExists(name))) return name;
  }
  return `${base} ${Date.now()}`;
}

export async function createWhiteboardPage(
  panelId: string,
  cursor: CursorData | null,
): Promise<DbId | null> {
  const baseName = t("Untitled whiteboard");
  let name = baseName;
  try {
    name = await pickFreeAliasName(baseName);
  } catch (err: unknown) {
    console.warn("[whiteboard] alias probe failed", err);
  }

  let newId: DbId | null = null;
  try {
    newId = await insertRootTextPage(name, cursor);
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
    orca.notify(
      "error",
      err instanceof Error
        ? err.message
        : t("Failed to mark this page as a whiteboard"),
    );
    return newId;
  }

  const alias = await assignPageAlias(newId, name);
  if (alias == null) {
    orca.notify(
      "warn",
      t(
        "Created the whiteboard but could not make it a page. You can add a page alias yourself.",
      ),
    );
  }

  try {
    await tagNewWhiteboard(newId, cursor);
  } catch (err: unknown) {
    console.warn("[whiteboard] failed to tag new whiteboard page", err);
  }

  openBoard(newId, panelId, false);
  return newId;
}

export function resolveTargetBlockId(explicit?: unknown): DbId | null {
  const fromArg = asBlockId(explicit);
  if (fromArg != null) return fromArg;
  try {
    const selection = window.getSelection?.() ?? null;
    const cursor = orca.utils.getCursorDataFromSelection(selection);
    const fromCursor = asBlockId(cursor?.anchor?.blockId);
    if (fromCursor != null) return fromCursor;
  } catch (err: unknown) {
    console.warn("[whiteboard] cursor lookup failed", err);
  }
  try {
    const panel = orca.nav.findViewPanel(
      orca.state.activePanel,
      orca.state.panels,
    );
    const fromPanel = asBlockId(panel?.viewArgs?.blockId);
    if (fromPanel != null) return fromPanel;
  } catch (err: unknown) {
    console.warn("[whiteboard] active panel lookup failed", err);
  }
  return null;
}

export async function turnIntoWhiteboard(
  blockId: DbId,
  panelId?: string,
): Promise<boolean> {
  let block: Block | null;
  try {
    block = await loadBoardBlock(blockId);
  } catch (err: unknown) {
    console.error("[whiteboard] failed to load block for turn-into", err);
    orca.notify("error", t("Failed to load this block"));
    return false;
  }
  if (block == null) {
    orca.notify("error", t("Failed to load this block"));
    return false;
  }

  if (isWhiteboardBlock(block)) {
    orca.notify("info", t("This is already a whiteboard"));
    return false;
  }

  const cardsRead = tryReadCards(block);
  if (!cardsRead.ok) {
    notifyBoardUnreadable(blockId);
    return false;
  }

  try {
    await writePageWhiteboardFlag(blockId, true);
  } catch (err: unknown) {
    console.error("[whiteboard] failed to mark page as whiteboard", err);
    orca.notify(
      "error",
      err instanceof Error
        ? err.message
        : t("Failed to turn this block into a whiteboard"),
    );
    return false;
  }

  const childIds = Array.isArray(block.children) ? block.children : [];
  const plan = planTurnIntoCards(cardsRead.value, childIds, blockId);
  if (plan.action === "write" && plan.cards.length > 0) {
    try {
      await writeCards(blockId, plan.cards);
    } catch (err: unknown) {
      console.error("[whiteboard] failed to write converted cards", err);
      orca.notify(
        "error",
        err instanceof Error
          ? err.message
          : t("Whiteboard cards were not saved"),
      );
    }
  }

  openBoard(blockId, panelId ?? orca.state.activePanel, false);
  return true;
}

export async function turnBackIntoOutline(blockId: DbId): Promise<boolean> {
  let block: Block | null;
  try {
    block = await loadBoardBlock(blockId);
  } catch (err: unknown) {
    console.error("[whiteboard] failed to load block for turn-back", err);
    orca.notify("error", t("Failed to load this block"));
    return false;
  }
  if (block == null) {
    orca.notify("error", t("Failed to load this block"));
    return false;
  }
  const page = isPageWhiteboardBlock(block);
  const inline = isInlineWhiteboardBlock(block);
  if (!page && !inline) {
    orca.notify("info", t("This is not a whiteboard"));
    return false;
  }

  try {
    if (page) {
      await clearPageWhiteboardFlag(blockId);
    } else {
      await writeBlockRepr(blockId, { type: "text" });
    }
  } catch (err: unknown) {
    console.error("[whiteboard] failed to restore outline", err);
    orca.notify(
      "error",
      err instanceof Error
        ? err.message
        : t("Failed to turn this whiteboard back into an outline"),
    );
    return false;
  }
  revealOutlineAfterTurnBack(blockId);
  orca.notify("success", t("Turned back into an outline"));
  return true;
}

function revealOutlineAfterTurnBack(blockId: DbId): void {
  try {
    const panelId = orca.state.activePanel;
    const panel = orca.nav.findViewPanel(panelId, orca.state.panels);
    if (panel == null) return;
    if (panel.view !== PANEL_TYPE) return;
    if (asBlockId(panel.viewArgs?.blockId) !== blockId) return;
    suppressOutlineRedirect(panelId, blockId);
    orca.nav.replace("block", { blockId }, panelId);
  } catch (err: unknown) {
    console.warn("[whiteboard] failed to show outline after turn-back", err);
  }
}
