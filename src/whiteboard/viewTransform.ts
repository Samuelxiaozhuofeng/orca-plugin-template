import type { DbId } from "../orca.d.ts";
import {
  clampScale,
  MAX_SCALE,
  MIN_SCALE,
  type WhiteboardCard,
} from "./data";

export type CanvasView = { x: number; y: number; scale: number };

export const DEFAULT_VIEW: CanvasView = { x: 0, y: 0, scale: 1 };
export const VIEW_GRID_SIZE = 24;
export const CARD_LOD_SCALE = 0.6;
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

export function visibleCards<T extends WhiteboardCard>(
  cards: T[],
  view: CanvasView,
  viewport: { width: number; height: number },
  alwaysInclude: DbId | null,
): T[] {
  if (cards.length === 0) return cards;
  return cards.filter(
    (card) =>
      (alwaysInclude != null && card.blockId === alwaysInclude) ||
      cardIntersectsViewport(card, view, viewport),
  );
}

export function cachedBlockPlainText(
  blockId: DbId,
  blocks: {
    [id: number]: { text?: string; children?: DbId[] } | undefined;
  },
): string {
  const seen = new Set<DbId>();
  const walk = (id: DbId): string => {
    if (seen.has(id)) return "";
    seen.add(id);
    const block = blocks[id];
    if (block == null) return "";
    if (typeof block.text === "string" && block.text.trim() !== "") {
      return block.text;
    }
    const parts: string[] = [];
    for (const childId of block.children ?? []) {
      const piece = walk(childId);
      if (piece) parts.push(piece);
    }
    return parts.join("\n");
  };
  return walk(blockId);
}

export function cardExcerpt(text: string | undefined): string {
  if (text == null) return "";
  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (trimmed === "") return "";
  if (trimmed.length <= EXCERPT_CHARS) return trimmed;
  return `${trimmed.slice(0, EXCERPT_CHARS).trimEnd()}…`;
}
