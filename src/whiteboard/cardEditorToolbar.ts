/**
 * Orca portals the selection toolbar and completion popups (@ / /) into the
 * card's .orca-block-editor subtree as position:absolute, so card overflow
 * clips them and canvas zoom distorts their size.
 *
 * We do not move the nodes (Orca resolves the target editor and block context
 * from that subtree). Instead we switch them to position:fixed. The canvas
 * transform is then the containing block: intermediate overflow (card-body,
 * block-editor, card) no longer clips, left/top are canvas-local, and a
 * 1/scale transform keeps the visual size at 1:1.
 */

import {
  EDITOR_POPUP_FALLBACK_H,
  EDITOR_POPUP_FALLBACK_W,
  EDITOR_POPUP_GAP,
  EDITOR_POPUP_PAD,
  EDITOR_TOOLBAR_FALLBACK_H,
  EDITOR_TOOLBAR_FALLBACK_W,
  EDITOR_TOOLBAR_GAP,
  EDITOR_TOOLBAR_PAD,
  canvasScaleFromMatrix,
  placeEditorFloating,
  viewportToCanvasLocal,
  type ToolbarBox,
} from "./cardEditorFloatingLayout.ts";

export * from "./cardEditorFloatingLayout.ts";

export const FIXED_TOOLBAR_CLASS = "owb-editor-toolbar-fixed";

const TOOLBAR_SELECTOR = ".orca-editor-toolbar";
const POPUP_SELECTOR = ".orca-popup";
const FLOATING_SELECTOR = `${TOOLBAR_SELECTOR}, ${POPUP_SELECTOR}`;
const EDITOR_SELECTOR = ".orca-block-editor";
const CARD_SELECTOR = ".owb-card";
const CANVAS_SELECTOR = ".owb-canvas";
const VIEWPORT_SELECTOR = ".owb-viewport";

type PinRecord = {
  el: HTMLElement;
  styleWatch: MutationObserver | null;
};

let observer: MutationObserver | null = null;
let raf = 0;
const pinned = new Map<HTMLElement, PinRecord>();

export function startCardEditorToolbar(): void {
  stopCardEditorToolbar();
  if (typeof document === "undefined") return;
  try {
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    scanExisting();
    startLoop();
  } catch {
    stopCardEditorToolbar();
  }
}

export function stopCardEditorToolbar(): void {
  observer?.disconnect();
  observer = null;
  stopLoop();
  for (const rec of [...pinned.values()]) {
    unpin(rec.el);
  }
  pinned.clear();
}

function onMutations(records: MutationRecord[]): void {
  try {
    for (const record of records) {
      for (const node of Array.from(record.removedNodes)) {
        forgetTree(node);
      }
      for (const node of Array.from(record.addedNodes)) {
        scan(node);
      }
    }
  } catch {
    /* host class names or a detached tree — leave the floating UI alone */
  }
}

function scanExisting(): void {
  try {
    document
      .querySelectorAll(
        `${CARD_SELECTOR} ${TOOLBAR_SELECTOR}, ${CARD_SELECTOR} ${POPUP_SELECTOR}`,
      )
      .forEach((el) => {
        if (el instanceof HTMLElement) pin(el);
      });
  } catch {
    /* ignore */
  }
}

function scan(root: Node): void {
  const found: HTMLElement[] = [];
  collect(root, found);
  for (const el of found) pin(el);
}

function collect(node: Node, into: HTMLElement[]): void {
  if (!(node instanceof HTMLElement)) {
    node.childNodes?.forEach((child) => collect(child, into));
    return;
  }
  // Cheap gate: this observer sees every DOM change in the host app, and
  // nothing outside a card is ever pinned.
  if (node.closest(CARD_SELECTOR) == null) return;
  if (node.matches(FLOATING_SELECTOR)) {
    if (node.parentElement?.closest(FLOATING_SELECTOR) == null) {
      into.push(node);
    }
  }
  node.querySelectorAll(FLOATING_SELECTOR).forEach((el) => {
    if (
      el instanceof HTMLElement &&
      el.closest(CARD_SELECTOR) != null &&
      el.parentElement?.closest(FLOATING_SELECTOR) == null
    ) {
      into.push(el);
    }
  });
}

function forgetTree(node: Node): void {
  if (!(node instanceof HTMLElement)) return;
  if (pinned.has(node)) unpin(node);
  node.querySelectorAll(FLOATING_SELECTOR).forEach((el) => {
    if (el instanceof HTMLElement) unpin(el);
  });
}

function pin(el: HTMLElement): void {
  if (pinned.has(el)) return;
  if (el.closest(CARD_SELECTOR) == null) return;
  if (el.closest(CANVAS_SELECTOR) == null) return;
  if (el.parentElement?.closest(FLOATING_SELECTOR) != null) return;
  // Only the editor's own floating UI. Other host popups that happen to sit
  // over a card (hover previews, block pickers) keep their own placement.
  if (el.closest(EDITOR_SELECTOR) == null) return;

  const rec: PinRecord = { el, styleWatch: null };
  try {
    el.classList.add(FIXED_TOOLBAR_CLASS);
  } catch {
    return;
  }
  pinned.set(el, rec);
  rec.styleWatch = watchHostStyle(el);
  applyPlace(el);
  startLoop();
}

function unpin(el: HTMLElement): void {
  const rec = pinned.get(el);
  if (rec == null) return;
  rec.styleWatch?.disconnect();
  rec.styleWatch = null;
  pinned.delete(el);
  clearPinStyles(el);
}

function clearPinStyles(el: HTMLElement): void {
  try {
    el.classList.remove(FIXED_TOOLBAR_CLASS);
    el.style.removeProperty("left");
    el.style.removeProperty("top");
    el.style.removeProperty("transform");
    el.style.removeProperty("transform-origin");
  } catch {
    /* node already gone */
  }
}

function watchHostStyle(el: HTMLElement): MutationObserver | null {
  try {
    let applying = false;
    const watch = new MutationObserver(() => {
      if (applying || !pinned.has(el)) return;
      applying = true;
      try {
        applyPlace(el);
      } finally {
        applying = false;
      }
    });
    watch.observe(el, { attributes: true, attributeFilter: ["style"] });
    return watch;
  } catch {
    return null;
  }
}

function startLoop(): void {
  if (raf !== 0 || pinned.size === 0) return;
  const tick = () => {
    if (pinned.size === 0) {
      raf = 0;
      return;
    }
    for (const rec of pinned.values()) applyPlace(rec.el);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

function stopLoop(): void {
  if (raf === 0) return;
  cancelAnimationFrame(raf);
  raf = 0;
}

function applyPlace(el: HTMLElement): void {
  if (!el.isConnected || el.closest(CARD_SELECTOR) == null) {
    unpin(el);
    return;
  }
  const canvas = el.closest(CANVAS_SELECTOR);
  if (!(canvas instanceof HTMLElement)) return;

  const isPopup = el.matches(POPUP_SELECTOR);
  const anchor = readAnchorClientRect(el, isPopup ? "popup" : "toolbar");
  if (anchor == null) return;

  const scale = readCanvasScale(canvas);
  const canvasRect = canvas.getBoundingClientRect();
  const viewport = readBoardViewport(canvas, canvasRect);

  const floating = {
    width:
      el.offsetWidth ||
      (isPopup ? EDITOR_POPUP_FALLBACK_W : EDITOR_TOOLBAR_FALLBACK_W),
    height:
      el.offsetHeight ||
      (isPopup ? EDITOR_POPUP_FALLBACK_H : EDITOR_TOOLBAR_FALLBACK_H),
  };

  const placed = placeEditorFloating({
    anchor,
    floating,
    viewport,
    prefer: isPopup ? "below" : "above",
    gap: isPopup ? EDITOR_POPUP_GAP : EDITOR_TOOLBAR_GAP,
    pad: isPopup ? EDITOR_POPUP_PAD : EDITOR_TOOLBAR_PAD,
  });

  const local = viewportToCanvasLocal(
    placed.left,
    placed.top,
    canvasRect,
    scale,
  );
  const left = `${local.x}px`;
  const top = `${local.y}px`;
  const transform = `scale(${1 / scale})`;
  if (
    el.style.left === left &&
    el.style.top === top &&
    el.style.transform === transform
  ) {
    return;
  }
  el.style.left = left;
  el.style.top = top;
  el.style.transform = transform;
  el.style.transformOrigin = "top left";
}

function readCanvasScale(canvas: HTMLElement): number {
  try {
    const raw = getComputedStyle(canvas).transform;
    if (!raw || raw === "none") return 1;
    return canvasScaleFromMatrix(new DOMMatrix(raw));
  } catch {
    return 1;
  }
}

function readBoardViewport(
  canvas: HTMLElement,
  fallback: DOMRect,
): { left: number; top: number; width: number; height: number } {
  try {
    const vp = canvas.closest(VIEWPORT_SELECTOR);
    if (vp instanceof HTMLElement) {
      const rect = vp.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    }
  } catch {
    /* fall through */
  }
  return {
    left: fallback.left,
    top: fallback.top,
    width: fallback.width,
    height: fallback.height,
  };
}

function readAnchorClientRect(
  el: HTMLElement,
  mode: "toolbar" | "popup",
): ToolbarBox | null {
  try {
    const card = el.closest(CARD_SELECTOR);
    const sel = document.getSelection();
    if (sel != null && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const anchorNode =
        range.startContainer instanceof Element
          ? range.startContainer
          : range.startContainer.parentElement;

      // Only use the active selection if it belongs to the card holding this element
      if (card == null || (anchorNode != null && card.contains(anchorNode))) {
        if (mode === "toolbar") {
          if (!range.collapsed) {
            const first =
              range.getClientRects()[0] ?? range.getBoundingClientRect();
            if (first != null && (first.width > 0 || first.height > 0)) {
              return {
                x: first.left,
                y: first.top,
                width: first.width,
                height: first.height,
              };
            }
          }
        } else {
          // popup mode: range can be collapsed (cursor) or non-collapsed
          const rects = range.getClientRects();
          if (rects.length > 0) {
            const first = rects[0];
            if (first != null && (first.width > 0 || first.height > 0)) {
              return {
                x: first.left,
                y: first.top,
                width: first.width,
                height: first.height,
              };
            }
          }
          const b = range.getBoundingClientRect();
          if (b != null && (b.width > 0 || b.height > 0)) {
            return {
              x: b.left,
              y: b.top,
              width: b.width,
              height: b.height,
            };
          }
          if (anchorNode != null) {
            const nodeRect = anchorNode.getBoundingClientRect();
            if (
              nodeRect != null &&
              (nodeRect.width > 0 || nodeRect.height > 0)
            ) {
              return {
                x: nodeRect.left,
                y: nodeRect.top,
                width: nodeRect.width,
                height: nodeRect.height,
              };
            }
          }
        }
      }
    }

    if (mode === "popup" && card != null) {
      const focusedBlock = card.querySelector(
        ".orca-block.is-focused, .orca-block-active, .orca-block-editor-main",
      );
      if (focusedBlock instanceof HTMLElement) {
        const b = focusedBlock.getBoundingClientRect();
        if (b != null && (b.width > 0 || b.height > 0)) {
          return {
            x: b.left,
            y: b.top,
            width: b.width,
            height: b.height,
          };
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}
