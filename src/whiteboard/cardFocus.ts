import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { getOpenBoard } from "./boards";
import { clampScale, type WhiteboardCard } from "./data";
import { fitViewForBoxes } from "./fitView";
import type { CanvasView } from "./viewTransform";

const { useEffect } = window.React;

const PENDING_TTL_MS = 60_000;
const PENDING_WAIT_MS = 3_000;
const VIEW_ANIM_MS = 240;
const FLASH_MS = 1_200;
const VIEW_ANIM_CLASS = "is-view-animating";
const FLASH_CLASS = "is-focus-flash";

type PendingFocus = { cardBlockId: DbId; at: number };

const pending = new Map<DbId, PendingFocus>();
const flashTimers = new Map<HTMLElement, number>();

let viewAnimTimer = 0;
let viewAnimCleanup: (() => void) | null = null;

export const CARD_FOCUS_WAIT_MS = PENDING_WAIT_MS;

export type CanvasFocusApi = {
  focusCard: (cardBlockId: DbId) => boolean;
  /** Frames every card on the board. False when there is nothing to frame. */
  fitAll: () => boolean;
  /** Frames the given boxes (selection, or any subset). */
  fitBoxes: (boxes: readonly WhiteboardCard[]) => boolean;
};

export function focusView(
  card: Pick<WhiteboardCard, "x" | "y" | "w" | "h">,
  viewport: { width: number; height: number },
  currentScale: number,
): CanvasView {
  const scale = clampScale(Math.max(currentScale, 1));
  return {
    x: viewport.width / 2 - (card.x + card.w / 2) * scale,
    y: viewport.height / 2 - (card.y + card.h / 2) * scale,
    scale,
  };
}

export function requestCardFocus(boardId: DbId, cardBlockId: DbId): void {
  const open = getOpenBoard(boardId);
  if (open != null) {
    if (!open.focusCard(cardBlockId)) {
      orca.notify("info", t("This card is no longer on the board"));
    }
    return;
  }
  pending.set(boardId, { cardBlockId, at: Date.now() });
}

export function takePendingCardFocus(boardId: DbId): DbId | null {
  const item = pending.get(boardId);
  if (item == null) return null;
  pending.delete(boardId);
  if (Date.now() - item.at > PENDING_TTL_MS) return null;
  return item.cardBlockId;
}

export function clearAllPendingCardFocus(): void {
  pending.clear();
  clearViewAnimation();
  for (const [el, timer] of flashTimers) {
    window.clearTimeout(timer);
    el.classList.remove(FLASH_CLASS);
  }
  flashTimers.clear();
}

const INLINE_REF_SELECTOR =
  ".orca-inline[data-type='r'], .orca-inline-r-content";

export function cardBlockIdFromInlineRefTarget(
  target: EventTarget | null,
): DbId | null {
  if (!(target instanceof Element)) return null;
  const hit = target.closest(INLINE_REF_SELECTOR);
  if (hit == null) return null;
  const host =
    hit.closest<HTMLElement>(".orca-inline[data-type='r']") ??
    (hit instanceof HTMLElement ? hit : null);
  if (host == null) return null;
  const id = Number(host.getAttribute("data-ref"));
  return Number.isFinite(id) ? id : null;
}

export function shouldInterceptRefClick(event: {
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  button?: number;
}): boolean {
  if (event.button != null && event.button !== 0) return false;
  return !event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey;
}

/** Pan to the card when an inline ref points at a block that is on this board. */
export function tryFocusCardFromRefClick(
  event: {
    target: EventTarget | null;
    altKey: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    button?: number;
    preventDefault: () => void;
    stopPropagation: () => void;
    nativeEvent?: { stopImmediatePropagation?: () => void };
  },
  cards: readonly { blockId: DbId }[],
  focusCard: ((cardBlockId: DbId) => boolean) | null | undefined,
): boolean {
  if (!shouldInterceptRefClick(event)) return false;
  const id = cardBlockIdFromInlineRefTarget(event.target);
  if (id == null) return false;
  if (!cards.some((card) => card.blockId === id)) return false;
  if (focusCard == null || !focusCard(id)) return false;
  event.preventDefault();
  event.stopPropagation();
  event.nativeEvent?.stopImmediatePropagation?.();
  return true;
}

export function applyCanvasCardFocus(opts: {
  cardBlockId: DbId;
  cards: readonly WhiteboardCard[];
  viewport: { width: number; height: number };
  currentScale: number;
  canvas: HTMLElement | null;
  grid: HTMLElement | null;
  viewportEl: HTMLElement | null;
  onViewChange: (view: CanvasView) => void;
  selectCards: (ids: DbId[]) => void;
}): boolean {
  const card = opts.cards.find((item) => item.blockId === opts.cardBlockId);
  if (card == null) return false;
  // A panel opened just for this jump may not have been measured yet, so the
  // tracked viewport size can still be the default. Trust the live element.
  const viewport = liveViewportSize(opts.viewportEl) ?? opts.viewport;
  const next = focusView(card, viewport, opts.currentScale);
  beginViewAnimation(opts.canvas, opts.grid, opts.viewportEl);
  opts.onViewChange(next);
  opts.selectCards([opts.cardBlockId]);
  scheduleCardFlash(opts.canvas, opts.cardBlockId);
  return true;
}

export function applyCanvasFitAll(opts: {
  cards: readonly WhiteboardCard[];
  viewport: { width: number; height: number };
  canvas: HTMLElement | null;
  grid: HTMLElement | null;
  viewportEl: HTMLElement | null;
  onViewChange: (view: CanvasView) => void;
}): boolean {
  return applyCanvasFitBoxes({ ...opts, boxes: opts.cards });
}

export function applyCanvasFitBoxes(opts: {
  boxes: readonly Pick<WhiteboardCard, "x" | "y" | "w" | "h">[];
  viewport: { width: number; height: number };
  canvas: HTMLElement | null;
  grid: HTMLElement | null;
  viewportEl: HTMLElement | null;
  onViewChange: (view: CanvasView) => void;
}): boolean {
  const viewport = liveViewportSize(opts.viewportEl) ?? opts.viewport;
  const next = fitViewForBoxes(opts.boxes, viewport);
  if (next == null) return false;
  beginViewAnimation(opts.canvas, opts.grid, opts.viewportEl);
  opts.onViewChange(next);
  return true;
}

export function useCanvasFocusApi(
  apiRef: { current: CanvasFocusApi | null },
  ctx: {
    cardsRef: { current: readonly WhiteboardCard[] };
    liveViewRef: { current: CanvasView };
    canvasRef: { current: HTMLElement | null };
    gridRef: { current: HTMLElement | null };
    viewportRef: { current: HTMLElement | null };
    viewportSize: { width: number; height: number };
    onViewChange: (view: CanvasView) => void;
    selectCards: (ids: DbId[]) => void;
  },
): void {
  const {
    cardsRef,
    liveViewRef,
    canvasRef,
    gridRef,
    viewportRef,
    viewportSize,
    onViewChange,
    selectCards,
  } = ctx;
  useEffect(() => {
    apiRef.current = {
      focusCard: (cardBlockId: DbId) =>
        applyCanvasCardFocus({
          cardBlockId,
          cards: cardsRef.current,
          viewport: viewportSize,
          currentScale: liveViewRef.current.scale,
          canvas: canvasRef.current,
          grid: gridRef.current,
          viewportEl: viewportRef.current,
          onViewChange,
          selectCards,
        }),
      fitAll: () =>
        applyCanvasFitAll({
          cards: cardsRef.current,
          viewport: viewportSize,
          canvas: canvasRef.current,
          grid: gridRef.current,
          viewportEl: viewportRef.current,
          onViewChange,
        }),
      fitBoxes: (boxes) =>
        applyCanvasFitBoxes({
          boxes,
          viewport: viewportSize,
          canvas: canvasRef.current,
          grid: gridRef.current,
          viewportEl: viewportRef.current,
          onViewChange,
        }),
    };
    return () => {
      apiRef.current = null;
    };
  }, [
    apiRef,
    canvasRef,
    cardsRef,
    gridRef,
    liveViewRef,
    onViewChange,
    selectCards,
    viewportRef,
    viewportSize,
  ]);
}

function liveViewportSize(
  el: HTMLElement | null,
): { width: number; height: number } | null {
  if (el == null) return null;
  const width = el.clientWidth;
  const height = el.clientHeight;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

function clearViewAnimation(): void {
  if (viewAnimTimer !== 0) {
    window.clearTimeout(viewAnimTimer);
    viewAnimTimer = 0;
  }
  if (viewAnimCleanup != null) {
    viewAnimCleanup();
    viewAnimCleanup = null;
  }
}

function beginViewAnimation(
  canvas: HTMLElement | null,
  grid: HTMLElement | null,
  viewport: HTMLElement | null,
): void {
  clearViewAnimation();
  canvas?.classList.remove(VIEW_ANIM_CLASS);
  grid?.classList.remove(VIEW_ANIM_CLASS);
  canvas?.classList.add(VIEW_ANIM_CLASS);
  grid?.classList.add(VIEW_ANIM_CLASS);

  const stop = () => {
    canvas?.classList.remove(VIEW_ANIM_CLASS);
    grid?.classList.remove(VIEW_ANIM_CLASS);
    clearViewAnimation();
  };

  viewport?.addEventListener("pointerdown", stop, true);
  viewport?.addEventListener("mousedown", stop, true);
  viewport?.addEventListener("wheel", stop, true);
  viewAnimCleanup = () => {
    viewport?.removeEventListener("pointerdown", stop, true);
    viewport?.removeEventListener("mousedown", stop, true);
    viewport?.removeEventListener("wheel", stop, true);
  };
  viewAnimTimer = window.setTimeout(stop, VIEW_ANIM_MS);
}

function flashEl(canvas: HTMLElement | null, cardBlockId: DbId): boolean {
  const el = canvas?.querySelector<HTMLElement>(
    `[data-block-id="${cardBlockId}"]`,
  );
  if (el == null) return false;
  const prev = flashTimers.get(el);
  if (prev != null) window.clearTimeout(prev);
  el.classList.add(FLASH_CLASS);
  const timer = window.setTimeout(() => {
    el.classList.remove(FLASH_CLASS);
    flashTimers.delete(el);
  }, FLASH_MS);
  flashTimers.set(el, timer);
  return true;
}

function scheduleCardFlash(canvas: HTMLElement | null, cardBlockId: DbId): void {
  if (flashEl(canvas, cardBlockId)) return;
  window.requestAnimationFrame(() => {
    if (flashEl(canvas, cardBlockId)) return;
    window.requestAnimationFrame(() => {
      if (flashEl(canvas, cardBlockId)) return;
      window.setTimeout(() => {
        flashEl(canvas, cardBlockId);
      }, 50);
    });
  });
}
