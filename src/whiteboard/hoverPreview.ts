import type { DbId } from "../orca.d.ts";

export const HOVER_PREVIEW_DELAY_MS = 300;

export const CARD_REF_ROW_SELECTOR = ".owb-card-ref-row";

export type HoverPreviewPhase = "idle" | "pending" | "shown";

export type HoverPreviewState = {
  phase: HoverPreviewPhase;
  blockId: DbId | null;
  enteredAt: number;
};

export type HoverPreviewEvent =
  | { type: "enter"; blockId: DbId; at: number; gestureActive: boolean }
  | { type: "leave"; at: number }
  | { type: "tick"; at: number; gestureActive: boolean }
  | { type: "gesture"; at: number }
  | { type: "reset" };

export type HoverPreviewAction = "none" | "show" | "hide";

export function initialHoverPreviewState(): HoverPreviewState {
  return { phase: "idle", blockId: null, enteredAt: 0 };
}

/**
 * Pure timing / gating for the ref-row hover preview.
 * Input is enter / leave / tick / gesture plus a timestamp; output is
 * whether the host preview should open or close.
 */
export function stepHoverPreview(
  state: HoverPreviewState,
  event: HoverPreviewEvent,
  delayMs: number = HOVER_PREVIEW_DELAY_MS,
): { state: HoverPreviewState; action: HoverPreviewAction } {
  if (event.type === "reset" || event.type === "gesture") {
    return clear(state);
  }

  if (event.type === "leave") {
    return clear(state);
  }

  if (event.type === "enter") {
    if (event.gestureActive) return clear(state);
    if (state.phase === "shown" && state.blockId === event.blockId) {
      return { state, action: "none" };
    }
    const hide = state.phase === "shown";
    return {
      state: {
        phase: "pending",
        blockId: event.blockId,
        enteredAt: event.at,
      },
      action: hide ? "hide" : "none",
    };
  }

  if (event.type === "tick") {
    if (state.phase !== "pending" || state.blockId == null) {
      return { state, action: "none" };
    }
    if (event.gestureActive) return clear(state);
    if (event.at - state.enteredAt < delayMs) {
      return { state, action: "none" };
    }
    return {
      state: {
        phase: "shown",
        blockId: state.blockId,
        enteredAt: state.enteredAt,
      },
      action: "show",
    };
  }

  return { state, action: "none" };
}

function clear(
  state: HoverPreviewState,
): { state: HoverPreviewState; action: HoverPreviewAction } {
  return {
    state: initialHoverPreviewState(),
    action: state.phase === "shown" ? "hide" : "none",
  };
}

/** Drag / marquee / edge-draw / pan — read from classes the gesture modules already stamp. */
export function isWhiteboardGestureActive(from: Element | null): boolean {
  if (from == null) return false;
  const viewport = from.closest(".owb-viewport");
  if (viewport != null) {
    if (
      viewport.classList.contains("is-marqueeing") ||
      viewport.classList.contains("is-panning")
    ) {
      return true;
    }
    if (viewport.querySelector(".owb-canvas.is-drawing-edge") != null) {
      return true;
    }
    if (
      viewport.querySelector(".owb-card.is-dragging, .owb-card.is-resizing") !=
      null
    ) {
      return true;
    }
    return false;
  }
  return from.closest(".owb-card.is-dragging, .owb-card.is-resizing") != null;
}

export function refRowFromTarget(
  target: EventTarget | null,
): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(CARD_REF_ROW_SELECTOR);
}

export function blockIdFromRefRow(el: HTMLElement): DbId | null {
  const id = Number(el.getAttribute("data-ref"));
  return Number.isFinite(id) ? id : null;
}

let activeClose: (() => void) | null = null;
let previewOwner: object | null = null;
const gestureCancels = new Set<() => void>();

function dismissHostPreview(owner: object): void {
  if (previewOwner !== owner) return;
  previewOwner = null;
  const close = activeClose;
  activeClose = null;
  close?.();
}

function presentHostPreview(
  owner: object,
  blockId: DbId,
  el: HTMLElement,
): void {
  const prev = activeClose;
  activeClose = null;
  previewOwner = owner;
  prev?.();
  try {
    const close = orca.utils.showBlockPreview(blockId, el);
    activeClose = typeof close === "function" ? close : null;
  } catch {
    activeClose = null;
  }
}

function onDocumentPointerDown(): void {
  for (const cancel of gestureCancels) cancel();
}

function watchPointerDownToCancel(cancel: () => void): () => void {
  gestureCancels.add(cancel);
  if (gestureCancels.size === 1) {
    document.addEventListener("pointerdown", onDocumentPointerDown, true);
  }
  return () => {
    gestureCancels.delete(cancel);
    if (gestureCancels.size === 0) {
      document.removeEventListener("pointerdown", onDocumentPointerDown, true);
    }
  };
}

/** Event-delegated hover preview on one card tree. Returns a full teardown. */
export function attachCardRefHoverPreview(root: HTMLElement): () => void {
  const owner = {};
  let state = initialHoverPreviewState();
  let timer = 0;
  let anchor: HTMLElement | null = null;

  const clearTimer = (): void => {
    if (timer === 0) return;
    window.clearTimeout(timer);
    timer = 0;
  };

  const scheduleTick = (enteredAt: number): void => {
    clearTimer();
    const wait = Math.max(0, HOVER_PREVIEW_DELAY_MS - (Date.now() - enteredAt));
    timer = window.setTimeout(() => {
      timer = 0;
      dispatch({
        type: "tick",
        at: Date.now(),
        gestureActive: isWhiteboardGestureActive(root),
      });
    }, wait);
  };

  const dispatch = (event: HoverPreviewEvent): void => {
    const { state: next, action } = stepHoverPreview(state, event);
    state = next;
    if (action === "hide") dismissHostPreview(owner);
    if (action === "show" && next.blockId != null && anchor != null) {
      presentHostPreview(owner, next.blockId, anchor);
    }
    if (next.phase === "pending") scheduleTick(next.enteredAt);
    else clearTimer();
  };

  const onOver = (event: MouseEvent): void => {
    const row = refRowFromTarget(event.target);
    if (row == null) return;
    if (refRowFromTarget(event.relatedTarget) === row) return;
    const blockId = blockIdFromRefRow(row);
    if (blockId == null) return;
    anchor = row;
    const gestureActive =
      event.buttons !== 0 || isWhiteboardGestureActive(row);
    dispatch({ type: "enter", blockId, at: Date.now(), gestureActive });
  };

  const onOut = (event: MouseEvent): void => {
    const row = refRowFromTarget(event.target);
    if (row == null) return;
    if (refRowFromTarget(event.relatedTarget) === row) return;
    dispatch({ type: "leave", at: Date.now() });
  };

  root.addEventListener("mouseover", onOver);
  root.addEventListener("mouseout", onOut);
  const stopWatch = watchPointerDownToCancel(() => {
    dispatch({ type: "gesture", at: Date.now() });
  });

  return () => {
    stopWatch();
    root.removeEventListener("mouseover", onOver);
    root.removeEventListener("mouseout", onOut);
    clearTimer();
    anchor = null;
    dispatch({ type: "reset" });
  };
}
