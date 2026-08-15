import { clampScale } from "./layout.ts";
import type { CanvasView } from "./viewTransform.ts";

/** Breathing room kept between the content bounds and the viewport edge. */
export const FIT_VIEW_PADDING = 48;

/** Fitting never zooms past 100%: a board with two cards should centre them,
 * not blow them up to fill the screen. */
export const FIT_VIEW_MAX_SCALE = 1;

export type FitBox = { x: number; y: number; w: number; h: number };

export function contentBounds(boxes: readonly FitBox[]): FitBox | null {
  if (boxes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const box of boxes) {
    if (box.x < minX) minX = box.x;
    if (box.y < minY) minY = box.y;
    if (box.x + box.w > maxX) maxX = box.x + box.w;
    if (box.y + box.h > maxY) maxY = box.y + box.h;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { x: minX, y: minY, w: Math.max(maxX - minX, 0), h: Math.max(maxY - minY, 0) };
}

/** View that centres every box and, when needed, zooms out until they all fit.
 * Returns null when there is nothing to fit or the viewport has no size yet. */
export function fitViewForBoxes(
  boxes: readonly FitBox[],
  viewport: { width: number; height: number },
  opts?: { padding?: number; maxScale?: number },
): CanvasView | null {
  const bounds = contentBounds(boxes);
  if (bounds == null) return null;
  if (viewport.width <= 0 || viewport.height <= 0) return null;

  const padding = opts?.padding ?? FIT_VIEW_PADDING;
  const maxScale = opts?.maxScale ?? FIT_VIEW_MAX_SCALE;
  const usableW = Math.max(viewport.width - padding * 2, 1);
  const usableH = Math.max(viewport.height - padding * 2, 1);
  const needed = Math.min(
    bounds.w > 0 ? usableW / bounds.w : maxScale,
    bounds.h > 0 ? usableH / bounds.h : maxScale,
  );
  const scale = clampScale(Math.min(needed, maxScale));

  return {
    x: viewport.width / 2 - (bounds.x + bounds.w / 2) * scale,
    y: viewport.height / 2 - (bounds.y + bounds.h / 2) * scale,
    scale,
  };
}
