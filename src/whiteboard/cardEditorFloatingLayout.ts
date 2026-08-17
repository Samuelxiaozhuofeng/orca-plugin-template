/**
 * Pure coordinate math and viewport placement for card editor floating elements
 * (selection toolbar and @ / / completion popups).
 */

export const EDITOR_TOOLBAR_GAP = 8;
export const EDITOR_TOOLBAR_PAD = 8;
export const EDITOR_TOOLBAR_FALLBACK_W = 360;
export const EDITOR_TOOLBAR_FALLBACK_H = 44;

export const EDITOR_POPUP_GAP = 4;
export const EDITOR_POPUP_PAD = 8;
export const EDITOR_POPUP_FALLBACK_W = 200;
export const EDITOR_POPUP_FALLBACK_H = 180;

export type ToolbarBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FloatingPlacement = "above" | "below";

export type ToolbarPlace = {
  left: number;
  top: number;
  side: FloatingPlacement;
};

export type FloatingPlace = ToolbarPlace;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Viewport-space left/top for a floating element (toolbar or popup). */
export function placeEditorFloating(opts: {
  anchor: ToolbarBox;
  floating: { width: number; height: number };
  viewport: { width: number; height: number; left?: number; top?: number };
  prefer?: FloatingPlacement;
  gap?: number;
  pad?: number;
}): FloatingPlace {
  const prefer = opts.prefer ?? "above";
  const gap =
    opts.gap ?? (prefer === "above" ? EDITOR_TOOLBAR_GAP : EDITOR_POPUP_GAP);
  const pad =
    opts.pad ?? (prefer === "above" ? EDITOR_TOOLBAR_PAD : EDITOR_POPUP_PAD);
  const { anchor, floating, viewport } = opts;
  const vpLeft = viewport.left ?? 0;
  const vpTop = viewport.top ?? 0;

  const minLeft = vpLeft + pad;
  const maxLeft = vpLeft + viewport.width - floating.width - pad;
  const left = clamp(anchor.x, minLeft, Math.max(minLeft, maxLeft));

  const minTop = vpTop + pad;
  const maxTop = vpTop + viewport.height - floating.height - pad;

  if (prefer === "below") {
    const belowTop = anchor.y + anchor.height + gap;
    if (belowTop <= maxTop) {
      return {
        left,
        top: Math.max(minTop, belowTop),
        side: "below",
      };
    }
    const aboveTop = anchor.y - gap - floating.height;
    if (aboveTop >= minTop) {
      return {
        left,
        top: Math.min(aboveTop, Math.max(minTop, maxTop)),
        side: "above",
      };
    }
    return {
      left,
      top: clamp(belowTop, minTop, Math.max(minTop, maxTop)),
      side: "below",
    };
  }

  const aboveTop = anchor.y - gap - floating.height;
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
      anchor.y + anchor.height + gap,
      minTop,
      Math.max(minTop, maxTop),
    ),
    side: "below",
  };
}

/** Viewport-space left/top for a toolbar that should hug a selection rect. */
export function placeEditorToolbar(opts: {
  selection: ToolbarBox;
  toolbar: { width: number; height: number };
  viewport: { width: number; height: number; left?: number; top?: number };
  gap?: number;
  pad?: number;
}): ToolbarPlace {
  return placeEditorFloating({
    anchor: opts.selection,
    floating: opts.toolbar,
    viewport: opts.viewport,
    prefer: "above",
    gap: opts.gap,
    pad: opts.pad,
  });
}

/** Viewport-space left/top for a popup (slash menu / mention) that opens below the cursor. */
export function placeEditorPopup(opts: {
  anchor: ToolbarBox;
  popup: { width: number; height: number };
  viewport: { width: number; height: number; left?: number; top?: number };
  gap?: number;
  pad?: number;
}): ToolbarPlace {
  return placeEditorFloating({
    anchor: opts.anchor,
    floating: opts.popup,
    viewport: opts.viewport,
    prefer: "below",
    gap: opts.gap,
    pad: opts.pad,
  });
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
