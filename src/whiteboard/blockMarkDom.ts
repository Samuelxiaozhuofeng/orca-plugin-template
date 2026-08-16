import type { DbId } from "../orca.d.ts";
import { outlineMarkLabel, type CardBoardRef } from "./blockMarkLabel";

export const BLOCK_MARKS_CSS_ROLE = "whiteboard.blockmarks.styles";

/** Presence flag stamped onto host outline rows that already have a card. */
export const OWB_MARK_ATTR = "data-owb-mark";
/** Tooltip text for `content: attr(...)`. Set via setAttribute only. */
export const OWB_MARK_LABEL_ATTR = "data-owb-mark-label";

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

.orca-block[data-owb-mark][${OWB_MARK_LABEL_ATTR}]${HOST_HOVER_MAIN}::before {
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

export type MarkStampCtx = {
  boardsFor: (id: DbId) => CardBoardRef[] | undefined;
  currentBoardId: DbId | null;
};

let observer: MutationObserver | null = null;
let stampTimer: ReturnType<typeof setTimeout> | null = null;
const pendingStamp = new Set<Element>();
let stampCtx: MarkStampCtx = {
  boardsFor: () => undefined,
  currentBoardId: null,
};

export function setMarkStampCtx(ctx: MarkStampCtx): void {
  stampCtx = ctx;
}

/** Constant-size CSS. Empty table → no injection (same as before). */
export function buildBlockMarkCss(byBlock: { size: number }): string {
  if (byBlock.size === 0) return "";
  return BLOCK_MARK_CSS;
}

export function injectMarkStyles(tableSize: number): void {
  orca.themes.injectCSS(buildBlockMarkCss({ size: tableSize }), BLOCK_MARKS_CSS_ROLE);
}

export function removeBlockMarkStyles(): void {
  orca.themes.removeCSS(BLOCK_MARKS_CSS_ROLE);
}

export function startObserver(): void {
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

export function stopObserver(): void {
  observer?.disconnect();
  observer = null;
  if (stampTimer != null) {
    clearTimeout(stampTimer);
    stampTimer = null;
  }
  pendingStamp.clear();
}

export function teardownMarks(): void {
  stopObserver();
  clearDomMarks();
  removeBlockMarkStyles();
}

export function restampBlockIds(ids: ReadonlySet<DbId>): void {
  if (typeof document === "undefined") return;
  for (const id of ids) {
    for (const el of document.querySelectorAll(
      `${HOST_BLOCK_SELECTOR}[data-id="${id}"]`,
    )) {
      stampElement(el);
    }
  }
}

export function rescanDom(): void {
  if (typeof document === "undefined") return;
  if (document.body != null) stampSubtree(document.body);
  for (const el of document.querySelectorAll(`[${OWB_MARK_ATTR}]`)) {
    if (!el.matches(HOST_BLOCK_SELECTOR)) clearMark(el);
  }
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
  const boards = Number.isFinite(id)
    ? stampCtx.boardsFor(id as DbId)
    : undefined;
  if (boards == null || boards.length === 0) {
    clearMark(el);
    return;
  }
  const label = outlineMarkLabel(boards, stampCtx.currentBoardId);
  const prevLabel = el.getAttribute(OWB_MARK_LABEL_ATTR);
  if (
    el.hasAttribute(OWB_MARK_ATTR) &&
    (label == null ? prevLabel == null : prevLabel === label)
  ) {
    return;
  }
  el.setAttribute(OWB_MARK_ATTR, "");
  if (label == null) el.removeAttribute(OWB_MARK_LABEL_ATTR);
  else el.setAttribute(OWB_MARK_LABEL_ATTR, label);
}

function clearMark(el: Element): void {
  el.removeAttribute(OWB_MARK_ATTR);
  el.removeAttribute(OWB_MARK_LABEL_ATTR);
}
