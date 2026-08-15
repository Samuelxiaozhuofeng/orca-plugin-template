import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { onBoardCardsChanged } from "./boardEvents";
import {
  ensureBlocksLoaded,
  fetchWhiteboardBlocks,
  rememberInlineBoardId,
} from "./boards";
import { boardName, readCards } from "./data";
import {
  applyBoardCardIndex,
  boardCardIndexFrom,
  type BoardCardIndex,
} from "./blockMarkIndex";
import { rememberPageBoardInCache } from "./pageBoardListCache";
import {
  isPageWhiteboardBlock,
  isWhiteboardBlock,
} from "./pageBoardPlan";
import { readWhiteboardSettings } from "./settings";

export { applyBoardCardIndex, type BoardCardIndex } from "./blockMarkIndex";

export const BLOCK_MARKS_CSS_ROLE = "whiteboard.blockmarks.styles";

/** Presence flag stamped onto host outline rows that already have a card. */
export const OWB_MARK_ATTR = "data-owb-mark";
/** Tooltip text for `content: attr(...)`. Set via setAttribute only. */
export const OWB_MARK_LABEL_ATTR = "data-owb-mark-label";

const DEBOUNCE_MS = 300;
const STAMP_THROTTLE_MS = 32;

/**
 * Host DOM contract (undocumented; same selectors the old per-id CSS used):
 * - Outline / editor rows are `.orca-block[data-id="<numeric DbId>"]`.
 * - Hover chrome is the child `> .orca-repr > .orca-repr-main`.
 * - A virtual list may recycle a row by changing `data-id` in place.
 *
 * If the host renames these, marks silently disappear — no throw.
 */
const HOST_BLOCK_SELECTOR = ".orca-block[data-id]";
const HOST_HOVER_MAIN = ":has(> .orca-repr > .orca-repr-main:hover)";

const BLOCK_MARK_CSS = `:root {
  --owb-block-mark-shift: calc(var(--orca-spacing-xl) + 1.8rem);
}

.orca-block[data-owb-mark]::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  translate: var(--owb-block-mark-shift);
  box-sizing: border-box;
  width: 12px;
  height: 9px;
  border: 1.5px solid var(--orca-color-primary-5, #2F80ED);
  border-radius: 2px;
  background: linear-gradient(
      var(--orca-color-primary-5, #2F80ED),
      var(--orca-color-primary-5, #2F80ED)
    )
    center / 6px 1.5px no-repeat;
  pointer-events: none;
  opacity: 0.55;
}

.orca-block[data-owb-mark]${HOST_HOVER_MAIN}::after {
  opacity: 1;
}

.orca-block[data-owb-mark]${HOST_HOVER_MAIN}::before {
  content: attr(data-owb-mark-label);
  position: absolute;
  top: 0;
  right: 0;
  /* Sit just left of the mark: the row's right margin is narrow, so growing
     rightwards would run the label off the panel. */
  translate: calc(var(--owb-block-mark-shift) - 0.5rem);
  transform: translateX(-100%);
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--orca-color-bg-2);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
  white-space: pre;
  color: var(--orca-color-text-2);
  pointer-events: none;
  z-index: 2;
}`;

type BoardLike = {
  aliases?: string[];
  text?: string;
  properties?: readonly { name: string; value?: unknown }[];
};

let pluginName = "";
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeCards: (() => void) | null = null;
let unsubscribeSettings: (() => void) | null = null;
let rebuildSeq = 0;
let lastEnabled: boolean | undefined;

let cardBoards = new Map<DbId, string[]>();
let lastByBoard = new Map<DbId, BoardCardIndex>();
const pendingBoardIds = new Set<DbId>();
let observer: MutationObserver | null = null;
let stampTimer: ReturnType<typeof setTimeout> | null = null;
const pendingStamp = new Set<Element>();

export function startBlockMarks(name: string): void {
  stopBlockMarks();
  pluginName = name;
  lastEnabled = marksEnabled();
  unsubscribeCards = onBoardCardsChanged((boardId) => {
    pendingBoardIds.add(boardId);
    scheduleBoardFlush();
  });
  unsubscribeSettings = subscribePlugins(onPluginsChanged);
  void rebuildBlockMarks();
}

export function stopBlockMarks(): void {
  rebuildSeq += 1;
  if (debounceTimer != null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  unsubscribeCards?.();
  unsubscribeCards = null;
  unsubscribeSettings?.();
  unsubscribeSettings = null;
  lastEnabled = undefined;
  pluginName = "";
  cardBoards = new Map();
  lastByBoard = new Map();
  pendingBoardIds.clear();
  teardownMarks();
}

function subscribePlugins(callback: () => void): () => void {
  const valtio = (
    globalThis as {
      window?: {
        Valtio?: {
          subscribe: (proxyObject: object, cb: () => void) => () => void;
        };
      };
    }
  ).window?.Valtio;
  if (valtio == null) return () => {};
  return valtio.subscribe(orca.state.plugins, callback);
}

function onPluginsChanged(): void {
  const enabled = marksEnabled();
  if (enabled === lastEnabled) return;
  lastEnabled = enabled;
  if (enabled) {
    void rebuildBlockMarks();
    return;
  }
  teardownMarks();
}

function scheduleBoardFlush(): void {
  if (debounceTimer != null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void flushBoardUpdates();
  }, DEBOUNCE_MS);
}

async function flushBoardUpdates(): Promise<void> {
  const seq = rebuildSeq;
  const ids = [...pendingBoardIds];
  pendingBoardIds.clear();
  if (ids.length === 0) return;
  try {
    if (!marksEnabled()) {
      teardownMarks();
      return;
    }
    const affected = new Set<DbId>();
    for (const boardId of ids) {
      const changed = await applyLiveBoard(boardId);
      for (const id of changed) affected.add(id);
      if (seq !== rebuildSeq) return;
    }
    if (seq !== rebuildSeq) return;
    if (!marksEnabled()) {
      teardownMarks();
      return;
    }
    syncMarksAfterIds(affected);
  } catch (err) {
    console.error("[whiteboard] failed to update block marks", err);
  }
}

async function applyLiveBoard(boardId: DbId): Promise<DbId[]> {
  const prev = lastByBoard.get(boardId) ?? null;
  await ensureBlocksLoaded([boardId]);
  const block = orca.state.blocks[boardId];
  if (block == null || !isWhiteboardBlock(block)) {
    applyBoardCardIndex(cardBoards, prev, null);
    lastByBoard.delete(boardId);
    return prev?.cardIds.slice() ?? [];
  }
  if (isPageWhiteboardBlock(block)) rememberPageBoardInCache(boardId);
  else rememberInlineBoardId(boardId);
  const next = boardCardIndexFrom(boardName(block), readCards(block));
  if (
    prev != null &&
    prev.name === next.name &&
    prev.cardIds.length === next.cardIds.length &&
    prev.cardIds.every((id, i) => id === next.cardIds[i])
  ) {
    return [];
  }
  applyBoardCardIndex(cardBoards, prev, next);
  lastByBoard.set(boardId, next);
  const affected = new Set<DbId>(prev?.cardIds ?? []);
  for (const id of next.cardIds) affected.add(id);
  return [...affected];
}

function syncMarksAfterIds(ids: ReadonlySet<DbId>): void {
  if (!pluginName || cardBoards.size === 0) {
    teardownMarks();
    return;
  }
  orca.themes.injectCSS(buildBlockMarkCss(cardBoards), BLOCK_MARKS_CSS_ROLE);
  startObserver();
  restampBlockIds(ids);
}

function restampBlockIds(ids: ReadonlySet<DbId>): void {
  if (typeof document === "undefined") return;
  for (const id of ids) {
    for (const el of document.querySelectorAll(
      `${HOST_BLOCK_SELECTOR}[data-id="${id}"]`,
    )) {
      stampElement(el);
    }
  }
}

async function rebuildBlockMarks(): Promise<void> {
  const seq = ++rebuildSeq;
  try {
    if (!marksEnabled()) {
      teardownMarks();
      return;
    }
    const boards = await fetchWhiteboardBlocks();
    if (seq !== rebuildSeq) return;
    if (!marksEnabled()) {
      teardownMarks();
      return;
    }
    lastByBoard = new Map();
    for (const board of boards) {
      if (typeof board.id !== "number") continue;
      lastByBoard.set(
        board.id,
        boardCardIndexFrom(boardName(board), readCards(board)),
      );
    }
    cardBoards = collectCardBoards(boards);
    syncMarksFromTable();
  } catch (err) {
    console.error("[whiteboard] failed to rebuild block marks", err);
  }
}

function syncMarksFromTable(): void {
  if (!pluginName || cardBoards.size === 0) {
    teardownMarks();
    return;
  }
  orca.themes.injectCSS(buildBlockMarkCss(cardBoards), BLOCK_MARKS_CSS_ROLE);
  startObserver();
  rescanDom();
}

function teardownMarks(): void {
  stopObserver();
  clearDomMarks();
  removeBlockMarkStyles();
}

function removeBlockMarkStyles(): void {
  orca.themes.removeCSS(BLOCK_MARKS_CSS_ROLE);
}

function marksEnabled(): boolean {
  if (!pluginName) return false;
  return readWhiteboardSettings(
    orca.state.plugins[pluginName]?.settings as
      | Record<string, unknown>
      | undefined,
  ).markOutlineBlocks;
}

export function collectCardBoards(
  boards: readonly BoardLike[],
): Map<DbId, string[]> {
  const byBlock = new Map<DbId, string[]>();
  for (const board of boards) {
    const name = boardName(board);
    const seen = new Set<DbId>();
    for (const card of readCards(board)) {
      if (seen.has(card.blockId)) continue;
      seen.add(card.blockId);
      const names = byBlock.get(card.blockId);
      if (names) names.push(name);
      else byBlock.set(card.blockId, [name]);
    }
  }
  return byBlock;
}

export function markLabelFor(
  names: readonly string[] | undefined,
): string | null {
  if (names == null || names.length === 0) return null;
  if (names.length === 1) {
    return t('On the "${name}" whiteboard', { name: names[0] });
  }
  return t("On ${count} whiteboards", { count: String(names.length) });
}

/** Constant-size CSS. Empty table → no injection (same as before). */
export function buildBlockMarkCss(byBlock: Map<DbId, string[]>): string {
  if (byBlock.size === 0) return "";
  return BLOCK_MARK_CSS;
}

function startObserver(): void {
  if (observer != null) return;
  if (typeof MutationObserver === "undefined") return;
  const root = document.body;
  if (root == null) return;
  observer = new MutationObserver(onMutations);
  // Only childList + data-id: virtual lists recycle rows by rewriting data-id.
  // Do not watch our own data-owb-* attrs (would loop) or all attributes.
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-id"],
  });
}

function stopObserver(): void {
  observer?.disconnect();
  observer = null;
  if (stampTimer != null) {
    clearTimeout(stampTimer);
    stampTimer = null;
  }
  pendingStamp.clear();
}

function onMutations(records: MutationRecord[]): void {
  for (const rec of records) {
    if (rec.type === "attributes") {
      if (rec.target instanceof Element) pendingStamp.add(rec.target);
      continue;
    }
    for (const node of rec.addedNodes) {
      if (node instanceof Element) pendingStamp.add(node);
    }
  }
  if (stampTimer != null) return;
  stampTimer = setTimeout(flushPendingStamps, STAMP_THROTTLE_MS);
}

function flushPendingStamps(): void {
  stampTimer = null;
  const batch = [...pendingStamp];
  pendingStamp.clear();
  for (const el of batch) stampSubtree(el);
}

function rescanDom(): void {
  if (typeof document === "undefined") return;
  if (document.body != null) stampSubtree(document.body);
  for (const el of document.querySelectorAll(`[${OWB_MARK_ATTR}]`)) {
    if (!el.matches(HOST_BLOCK_SELECTOR)) clearMark(el);
  }
}

function clearDomMarks(): void {
  if (typeof document === "undefined") return;
  for (const el of document.querySelectorAll(
    `[${OWB_MARK_ATTR}], [${OWB_MARK_LABEL_ATTR}]`,
  )) {
    clearMark(el);
  }
}

function stampSubtree(root: Element): void {
  if (root.matches(HOST_BLOCK_SELECTOR)) stampElement(root);
  // Keystroke / format spans almost never contain a block; bail cheaply.
  if (root.querySelector(HOST_BLOCK_SELECTOR) == null) return;
  for (const el of root.querySelectorAll(HOST_BLOCK_SELECTOR)) {
    stampElement(el);
  }
}

function stampElement(el: Element): void {
  if (!el.classList.contains("orca-block")) {
    if (el.hasAttribute(OWB_MARK_ATTR) || el.hasAttribute(OWB_MARK_LABEL_ATTR)) {
      clearMark(el);
    }
    return;
  }
  const raw = el.getAttribute("data-id");
  const id = raw == null || raw === "" ? Number.NaN : Number(raw);
  const label = Number.isFinite(id)
    ? markLabelFor(cardBoards.get(id as DbId))
    : null;
  if (label == null) {
    clearMark(el);
    return;
  }
  if (
    el.hasAttribute(OWB_MARK_ATTR) &&
    el.getAttribute(OWB_MARK_LABEL_ATTR) === label
  ) {
    return;
  }
  el.setAttribute(OWB_MARK_ATTR, "");
  el.setAttribute(OWB_MARK_LABEL_ATTR, label);
}

function clearMark(el: Element): void {
  el.removeAttribute(OWB_MARK_ATTR);
  el.removeAttribute(OWB_MARK_LABEL_ATTR);
}
