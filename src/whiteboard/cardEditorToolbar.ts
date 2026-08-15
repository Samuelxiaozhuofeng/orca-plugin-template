/**
 * Orca portals the selection toolbar into the card's .orca-block-editor
 * as position:absolute, so card overflow clips a narrow card. We do not
 * move the node (Orca resolves the target editor from that subtree).
 * Instead we switch it to position:fixed. The canvas transform is then
 * the containing block: intermediate overflow no longer clips, left/top
 * are canvas-local, and a 1/scale transform keeps the bar's visual size
 * constant. applyViewToDom uses origin 0 0 + translate + scale.
 */

export const EDITOR_TOOLBAR_GAP = 8;
export const EDITOR_TOOLBAR_PAD = 8;
export const EDITOR_TOOLBAR_FALLBACK_W = 360;
export const EDITOR_TOOLBAR_FALLBACK_H = 44;

export const FIXED_TOOLBAR_CLASS = "owb-editor-toolbar-fixed";

const TOOLBAR_SELECTOR = ".orca-editor-toolbar";
const CARD_SELECTOR = ".owb-card";
const CANVAS_SELECTOR = ".owb-canvas";
const VIEWPORT_SELECTOR = ".owb-viewport";

export type ToolbarBox = { x: number; y: number; width: number; height: number };

export type ToolbarPlace = {
  left: number;
  top: number;
  side: "above" | "below";
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Viewport-space left/top for a toolbar that should hug a selection rect. */
export function placeEditorToolbar(opts: {
  selection: ToolbarBox;
  toolbar: { width: number; height: number };
  viewport: { width: number; height: number; left?: number; top?: number };
  gap?: number;
  pad?: number;
}): ToolbarPlace {
  const gap = opts.gap ?? EDITOR_TOOLBAR_GAP;
  const pad = opts.pad ?? EDITOR_TOOLBAR_PAD;
  const { selection, toolbar, viewport } = opts;
  const vpLeft = viewport.left ?? 0;
  const vpTop = viewport.top ?? 0;

  const minLeft = vpLeft + pad;
  const maxLeft = vpLeft + viewport.width - toolbar.width - pad;
  const left = clamp(selection.x, minLeft, Math.max(minLeft, maxLeft));

  const minTop = vpTop + pad;
  const maxTop = vpTop + viewport.height - toolbar.height - pad;
  const aboveTop = selection.y - gap - toolbar.height;
  if (aboveTop >= minTop) {
    return {
      left,
      top: Math.min(aboveTop, Math.max(minTop, maxTop)),
      side: "above",
    };
  }
  return {
    left,
    top: clamp(
      selection.y + selection.height + gap,
      minTop,
      Math.max(minTop, maxTop),
    ),
    side: "below",
  };
}

/** Uniform scale of a 2D matrix (hypot of the first column). */
export function canvasScaleFromMatrix(matrix: {
  a: number;
  b: number;
}): number {
  const scale = Math.hypot(matrix.a, matrix.b);
  return scale > 0 && Number.isFinite(scale) ? scale : 1;
}

/**
 * Map a viewport point into .owb-canvas local space.
 * Matches applyViewToDom: origin 0 0, then translate + scale.
 * canvasOrigin is canvas.getBoundingClientRect() (transformed origin).
 */
export function viewportToCanvasLocal(
  x: number,
  y: number,
  canvasOrigin: { left: number; top: number },
  scale: number,
): { x: number; y: number } {
  const s = scale === 0 || !Number.isFinite(scale) ? 1 : scale;
  return {
    x: (x - canvasOrigin.left) / s,
    y: (y - canvasOrigin.top) / s,
  };
}

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
    /* host class names or a detached tree — leave the toolbar alone */
  }
}

function scanExisting(): void {
  try {
    document
      .querySelectorAll(`${CARD_SELECTOR} ${TOOLBAR_SELECTOR}`)
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
  if (node.matches(TOOLBAR_SELECTOR)) {
    into.push(node);
  }
  node.querySelectorAll(TOOLBAR_SELECTOR).forEach((el) => {
    if (el instanceof HTMLElement && el.closest(CARD_SELECTOR) != null) {
      into.push(el);
    }
  });
}

function forgetTree(node: Node): void {
  if (!(node instanceof HTMLElement)) return;
  if (pinned.has(node)) unpin(node);
  node.querySelectorAll(TOOLBAR_SELECTOR).forEach((el) => {
    if (el instanceof HTMLElement) unpin(el);
  });
}

function pin(el: HTMLElement): void {
  if (pinned.has(el)) return;
  if (el.closest(CARD_SELECTOR) == null) return;
  if (el.closest(CANVAS_SELECTOR) == null) return;

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
  const selection = readSelectionClientRect();
  if (selection == null) return;

  const scale = readCanvasScale(canvas);
  const canvasRect = canvas.getBoundingClientRect();
  const viewport = readBoardViewport(canvas, canvasRect);
  const toolbar = {
    width: el.offsetWidth || EDITOR_TOOLBAR_FALLBACK_W,
    height: el.offsetHeight || EDITOR_TOOLBAR_FALLBACK_H,
  };
  const placed = placeEditorToolbar({ selection, toolbar, viewport });
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

function readSelectionClientRect(): ToolbarBox | null {
  try {
    const sel = document.getSelection();
    if (sel == null || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return null;
    const first = range.getClientRects()[0] ?? range.getBoundingClientRect();
    if (first == null || (first.width === 0 && first.height === 0)) return null;
    return {
      x: first.left,
      y: first.top,
      width: first.width,
      height: first.height,
    };
  } catch {
    return null;
  }
}
