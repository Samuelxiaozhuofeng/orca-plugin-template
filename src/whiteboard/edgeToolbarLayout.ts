/** Gap between the click point and the toolbar edge, in CSS pixels. */
export const EDGE_TOOLBAR_GAP = 48;
export const EDGE_TOOLBAR_PAD = 8;
export const EDGE_TOOLBAR_EST_WIDTH = 328;
export const EDGE_TOOLBAR_EST_HEIGHT = 40;

export type EdgeToolbarRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type EdgeToolbarPlace = {
  left: number;
  top: number;
  side: "above" | "below";
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Place a fixed-size toolbar near a click, flipping and clamping to stay on screen. */
export function placeEdgeToolbar(opts: {
  clickX: number;
  clickY: number;
  toolbarWidth: number;
  toolbarHeight: number;
  viewport: EdgeToolbarRect;
  gap?: number;
  pad?: number;
}): EdgeToolbarPlace {
  const gap = opts.gap ?? EDGE_TOOLBAR_GAP;
  const pad = opts.pad ?? EDGE_TOOLBAR_PAD;
  const { clickX, clickY, toolbarWidth, toolbarHeight, viewport } = opts;

  const minLeft = viewport.left + pad;
  const maxLeft = viewport.left + viewport.width - toolbarWidth - pad;
  const left = clamp(clickX - toolbarWidth / 2, minLeft, Math.max(minLeft, maxLeft));

  const minTop = viewport.top + pad;
  const maxTop = viewport.top + viewport.height - toolbarHeight - pad;
  const aboveTop = clickY - gap - toolbarHeight;
  if (aboveTop >= minTop) {
    return { left, top: Math.min(aboveTop, Math.max(minTop, maxTop)), side: "above" };
  }
  return {
    left,
    top: clamp(clickY + gap, minTop, Math.max(minTop, maxTop)),
    side: "below",
  };
}

export type EdgeToolbarSignal =
  | {
      kind: "select";
      prevId: string | null;
      nextId: string | null;
    }
  | { kind: "edge-press" }
  | { kind: "escape" }
  | { kind: "view-change" }
  | { kind: "marquee-start" }
  | { kind: "pan-start" }
  | { kind: "card-drag-start" }
  | { kind: "card-edit" }
  | { kind: "panel-blur" }
  | { kind: "toolbar-press" };

/**
 * Next open/closed state. The bar opens only when selection *changes* to a
 * line; pressing the already-selected line (or any other listed cause) hides
 * it and does not reopen until a later select signal would open it.
 */
export function nextEdgeToolbarOpen(signal: EdgeToolbarSignal): boolean {
  if (signal.kind === "toolbar-press") return true;
  if (signal.kind === "select") {
    return signal.nextId != null && signal.nextId !== signal.prevId;
  }
  return false;
}
