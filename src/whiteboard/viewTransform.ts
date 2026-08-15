import type { DbId } from "../orca.d.ts";
import {
  CARD_LOD_SCALE,
  CARD_MOUNT_CAP,
  clampScale,
  MAX_SCALE,
  MIN_SCALE,
} from "./layout.ts";
import type { WhiteboardCard } from "./data.ts";

export type CanvasView = { x: number; y: number; scale: number };

export const DEFAULT_VIEW: CanvasView = { x: 0, y: 0, scale: 1 };
export const VIEW_GRID_SIZE = 24;
export const WHEEL_COMMIT_MS = 160;

/**
 * Exponential zoom gain. Mouse-wheel / ⌘+wheel notches are ~100px
 * (deltaMode=0): 0.002 → about 18% per notch, close to the old ×1.1
 * but continuous for trackpad pixel deltas.
 *
 * Pinch-to-zoom in Electron/Chrome is a ctrlKey wheel stream at
 * pointer-event rate; the same 0.002 overshoots. 0.001 keeps pinch
 * in the same perceived speed band.
 */
export const WHEEL_ZOOM_K = 0.002;
export const PINCH_ZOOM_K = 0.001;

const DAMP_OVERFLOW = 0.2;
const EXCERPT_CHARS = 400;

export function formatZoomPercent(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

/** macOS pinch arrives as ctrlKey wheel without metaKey. */
export function isPinchZoomEvent(event: WheelEvent): boolean {
  return event.ctrlKey && !event.metaKey;
}

export function normalizeWheelDeltaY(event: WheelEvent): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * 800;
  return event.deltaY;
}

export function dampScale(scale: number): number {
  if (scale >= MIN_SCALE && scale <= MAX_SCALE) return scale;
  if (scale < MIN_SCALE) {
    return Math.max(
      MIN_SCALE * 0.85,
      MIN_SCALE - (MIN_SCALE - scale) * DAMP_OVERFLOW,
    );
  }
  return Math.min(
    MAX_SCALE * 1.15,
    MAX_SCALE + (scale - MAX_SCALE) * DAMP_OVERFLOW,
  );
}

export function scaleFromWheelDelta(
  current: number,
  deltaY: number,
  pinch: boolean,
): number {
  const k = pinch ? PINCH_ZOOM_K : WHEEL_ZOOM_K;
  return dampScale(current * Math.exp(-deltaY * k));
}

export function applyViewToDom(
  canvas: HTMLElement | null,
  grid: HTMLElement | null,
  zoomLabel: HTMLElement | null,
  view: CanvasView,
): void {
  if (canvas) {
    canvas.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  }
  if (grid) {
    const size = VIEW_GRID_SIZE * view.scale;
    grid.style.backgroundSize = `${size}px ${size}px`;
    grid.style.backgroundPosition = `${view.x}px ${view.y}px`;
  }
  if (zoomLabel) {
    zoomLabel.textContent = formatZoomPercent(view.scale);
  }
}

export function clientToWorld(
  viewport: HTMLElement | null,
  view: CanvasView,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  if (viewport == null) return { x: 0, y: 0 };
  const rect = viewport.getBoundingClientRect();
  const scale = view.scale === 0 ? 1 : view.scale;
  return {
    x: (clientX - rect.left - view.x) / scale,
    y: (clientY - rect.top - view.y) / scale,
  };
}

export function finalizeView(
  view: CanvasView,
  viewport: { width: number; height: number },
): CanvasView {
  if (view.scale >= MIN_SCALE && view.scale <= MAX_SCALE) return { ...view };
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  const safeScale = view.scale === 0 ? 1 : view.scale;
  const worldX = (cx - view.x) / safeScale;
  const worldY = (cy - view.y) / safeScale;
  const scale = clampScale(view.scale);
  return {
    scale,
    x: cx - worldX * scale,
    y: cy - worldY * scale,
  };
}

export function cardIntersectsViewport(
  card: Pick<WhiteboardCard, "x" | "y" | "w" | "h">,
  view: CanvasView,
  viewport: { width: number; height: number },
  marginScreens = 1,
): boolean {
  const left = card.x * view.scale + view.x;
  const top = card.y * view.scale + view.y;
  const right = left + card.w * view.scale;
  const bottom = top + card.h * view.scale;
  const padX = viewport.width * marginScreens;
  const padY = viewport.height * marginScreens;
  return (
    right >= -padX &&
    left <= viewport.width + padX &&
    bottom >= -padY &&
    top <= viewport.height + padY
  );
}

function asIdSet(
  alwaysInclude: DbId | Iterable<DbId> | null,
): Set<DbId> | null {
  if (alwaysInclude == null) return null;
  if (typeof alwaysInclude === "number") return new Set([alwaysInclude]);
  return new Set(alwaysInclude);
}

/**
 * Prefetch pad in screenfuls. Full pad at 100%+ (panning wants neighbours);
 * none at MIN_SCALE, where one extra screen would swallow the whole board.
 */
export function marginScreensForScale(scale: number): number {
  if (!(scale > MIN_SCALE)) return 0;
  if (scale >= 1) return 1;
  return (scale - MIN_SCALE) / (1 - MIN_SCALE);
}

export function isLodSimplified(scale: number): boolean {
  return scale < CARD_LOD_SCALE;
}

export function visibleCards<T extends WhiteboardCard>(
  cards: T[],
  view: CanvasView,
  viewport: { width: number; height: number },
  alwaysInclude: DbId | Iterable<DbId> | null,
  marginScreens = marginScreensForScale(view.scale),
): T[] {
  if (cards.length === 0) return cards;
  const pinned = asIdSet(alwaysInclude);
  return cards.filter(
    (card) =>
      (pinned != null && pinned.has(card.blockId)) ||
      cardIntersectsViewport(card, view, viewport, marginScreens),
  );
}

export type MountedCards<T> = {
  cards: T[];
  hiddenCount: number;
};

function cardDist2(
  card: Pick<WhiteboardCard, "x" | "y" | "w" | "h">,
  cx: number,
  cy: number,
): number {
  const dx = card.x + card.w / 2 - cx;
  const dy = card.y + card.h / 2 - cy;
  return dx * dx + dy * dy;
}

function sortByViewportCenter<T extends WhiteboardCard>(
  cards: T[],
  view: CanvasView | undefined,
  viewport: { width: number; height: number } | undefined,
): T[] {
  if (view == null || viewport == null || cards.length < 2) return cards;
  const scale = view.scale === 0 ? 1 : view.scale;
  const cx = (viewport.width / 2 - view.x) / scale;
  const cy = (viewport.height / 2 - view.y) / scale;
  return cards
    .map((card, index) => ({ card, index, d: cardDist2(card, cx, cy) }))
    .sort((a, b) => a.d - b.d || a.index - b.index)
    .map((item) => item.card);
}

/**
 * Cap how many visible cards actually mount. Editing is never dropped;
 * selected cards fill next; the rest are the nearest to the viewport centre.
 *
 * The live canvas does not pass `selectedIds` — select-all must not steal
 * the mount budget from the viewport. Prefer-selected remains for callers
 * that already culled to the window.
 */
export function pickMountedCards<T extends WhiteboardCard>(
  visible: readonly T[],
  opts: {
    cap?: number;
    editingId?: DbId | null;
    selectedIds?: readonly DbId[];
    view?: CanvasView;
    viewport?: { width: number; height: number };
  } = {},
): MountedCards<T> {
  const cap = opts.cap ?? CARD_MOUNT_CAP;
  const editingId = opts.editingId ?? null;
  const selected = new Set(opts.selectedIds ?? []);
  if (visible.length === 0) return { cards: [], hiddenCount: 0 };

  const editing: T[] = [];
  const preferred: T[] = [];
  const rest: T[] = [];
  for (const card of visible) {
    if (editingId != null && card.blockId === editingId) editing.push(card);
    else if (selected.has(card.blockId)) preferred.push(card);
    else rest.push(card);
  }

  const rankedPreferred = sortByViewportCenter(
    preferred,
    opts.view,
    opts.viewport,
  );
  const rankedRest = sortByViewportCenter(rest, opts.view, opts.viewport);

  const cards: T[] = [];
  for (const card of editing) cards.push(card);
  for (const card of rankedPreferred) {
    if (cards.length >= cap) break;
    cards.push(card);
  }
  for (const card of rankedRest) {
    if (cards.length >= cap) break;
    cards.push(card);
  }
  return { cards, hiddenCount: Math.max(0, visible.length - cards.length) };
}

/**
 * Cards that actually mount. Only the viewport (plus the card being edited)
 * may pin; selection never does.
 */
export function planShownCards<T extends WhiteboardCard>(
  cards: T[],
  view: CanvasView,
  viewport: { width: number; height: number },
  opts: { cap?: number; editingId?: DbId | null } = {},
): MountedCards<T> {
  const editingId = opts.editingId ?? null;
  const visible = visibleCards(cards, view, viewport, editingId);
  return pickMountedCards(visible, {
    cap: opts.cap,
    editingId,
    view,
    viewport,
  });
}

export const BLOCK_TREE_MAX_NODES = 2000;
export const BLOCK_TREE_MAX_DEPTH = 30;

export type BlockTextLookup = {
  [id: number]: { text?: string; children?: DbId[] } | undefined;
};

/** Depth-first ids of each root and its descendants. Shared by text + watchers. */
export function collectBlockTreeIds(
  roots: readonly DbId[],
  blocks: BlockTextLookup,
  maxNodes = BLOCK_TREE_MAX_NODES,
  maxDepth = BLOCK_TREE_MAX_DEPTH,
): DbId[] {
  const out: DbId[] = [];
  const seen = new Set<DbId>();
  const walk = (id: DbId, depth: number) => {
    if (out.length >= maxNodes || depth > maxDepth) return;
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
    const children = blocks[id]?.children;
    if (children == null) return;
    for (const child of children) walk(child, depth + 1);
  };
  for (const root of roots) walk(root, 0);
  return out;
}

export function cachedBlockPlainText(
  blockId: DbId,
  blocks: BlockTextLookup,
  maxNodes = BLOCK_TREE_MAX_NODES,
  maxDepth = BLOCK_TREE_MAX_DEPTH,
): string {
  const seen = new Set<DbId>();
  let nodes = 0;
  const walk = (id: DbId, depth: number): string => {
    if (nodes >= maxNodes || depth > maxDepth) return "";
    if (seen.has(id)) return "";
    seen.add(id);
    nodes += 1;
    const block = blocks[id];
    if (block == null) return "";
    if (typeof block.text === "string" && block.text.trim() !== "") {
      return block.text;
    }
    const parts: string[] = [];
    for (const childId of block.children ?? []) {
      const piece = walk(childId, depth + 1);
      if (piece) parts.push(piece);
    }
    return parts.join("\n");
  };
  return walk(blockId, 0);
}

export function cardExcerpt(text: string | undefined): string {
  if (text == null) return "";
  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (trimmed === "") return "";
  if (trimmed.length <= EXCERPT_CHARS) return trimmed;
  return `${trimmed.slice(0, EXCERPT_CHARS).trimEnd()}…`;
}
