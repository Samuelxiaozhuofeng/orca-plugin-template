import type { DbId } from "../orca.d.ts";
import {
  abortAllCardGestures,
  abortCardGestures,
  trackCardGesture,
} from "./cardGestureTrack";
import { MIN_CARD_HEIGHT, MIN_CARD_WIDTH } from "./data";
import { CLICK_THRESHOLD_PX } from "./marquee";
import { unionRects, type CardRect } from "./selection";
import { clearGuides, computeSnap, paintGuides } from "./snap";
import type { CanvasView } from "./viewTransform";

export { abortAllCardGestures, abortCardGestures };

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const RESIZE_HANDLES: ResizeHandle[] = [
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw",
];

export function applyCardBox(el: HTMLElement | null, box: CardRect): void {
  if (el == null) return;
  el.style.left = `${box.x}px`;
  el.style.top = `${box.y}px`;
  el.style.width = `${box.w}px`;
  el.style.height = `${box.h}px`;
}

export function cardHasLiveGesture(el: HTMLElement | null): boolean {
  return (
    el != null &&
    (el.classList.contains("is-dragging") || el.classList.contains("is-resizing"))
  );
}

export function isOnCardScrollbar(
  target: EventTarget | null,
  clientX: number,
  clientY: number,
): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const body = target.closest(".owb-card-body");
  if (!(body instanceof HTMLElement)) return false;
  const rect = body.getBoundingClientRect();
  const vBar = body.offsetWidth - body.clientWidth;
  const hBar = body.offsetHeight - body.clientHeight;
  const onV = vBar > 0 && clientX >= rect.right - vBar;
  const onH = hBar > 0 && clientY >= rect.bottom - hBar;
  return onV || onH;
}

function cardEl(canvas: HTMLElement, blockId: DbId): HTMLElement | null {
  return canvas.querySelector(`[data-block-id="${blockId}"]`);
}

export function restoreCardBoxes(
  canvas: HTMLElement,
  cards: ReadonlyArray<{ blockId: DbId } & CardRect>,
): void {
  for (const card of cards) {
    applyCardBox(cardEl(canvas, card.blockId), {
      x: card.x,
      y: card.y,
      w: card.w,
      h: card.h,
    });
  }
}

export const RIGHT_BUTTON_THRESHOLD_PX = 3;

function gestureRoot(el: HTMLElement | null | undefined): object | null {
  if (el == null) return null;
  return el.closest(".owb-canvas") ?? el.closest(".owb-viewport") ?? el;
}

export function swallowNextContextMenu(root?: object | null): void {
  let timer = 0;
  const onMenu = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const detachMenu = () => {
    window.removeEventListener("contextmenu", onMenu, true);
  };
  const done = () => {
    tracked.untrack();
    window.removeEventListener("mouseup", done);
    timer = window.setTimeout(detachMenu, 0);
  };
  const tracked = trackCardGesture(root ?? window, () => {
    window.removeEventListener("mouseup", done);
    if (timer !== 0) window.clearTimeout(timer);
    detachMenu();
  });
  window.addEventListener("contextmenu", onMenu, true);
  window.addEventListener("mouseup", done);
}

export function startRightButtonSession(opts: {
  startX: number;
  startY: number;
  root?: object | null;
  onDrag?: () => void;
  onIdleRelease: () => void;
}): void {
  let dragged = false;
  let finished = false;
  let allowSynthetic = false;
  let timer = 0;

  const onMenu = (event: Event) => {
    if (allowSynthetic) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const detach = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    window.removeEventListener("contextmenu", onMenu, true);
    if (timer !== 0) window.clearTimeout(timer);
  };

  const onMove = (event: MouseEvent) => {
    if (finished || dragged) return;
    const dx = event.clientX - opts.startX;
    const dy = event.clientY - opts.startY;
    if (
      dx * dx + dy * dy <
      RIGHT_BUTTON_THRESHOLD_PX * RIGHT_BUTTON_THRESHOLD_PX
    ) {
      return;
    }
    dragged = true;
    opts.onDrag?.();
  };

  const onUp = () => {
    if (finished) return;
    finished = true;
    tracked.untrack();
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    if (!dragged) {
      allowSynthetic = true;
      opts.onIdleRelease();
      allowSynthetic = false;
    }
    timer = window.setTimeout(() => {
      window.removeEventListener("contextmenu", onMenu, true);
    }, 0);
  };

  const tracked = trackCardGesture(opts.root ?? window, () => {
    if (finished) return;
    finished = true;
    detach();
  });

  window.addEventListener("contextmenu", onMenu, true);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

export type MoveCardsEnd = {
  moves: ReadonlyArray<{ blockId: DbId; x: number; y: number }>;
  /** True when the pointer crossed the click threshold (a real drag). */
  dragged: boolean;
  altKey: boolean;
  clientX: number;
  clientY: number;
  world: { x: number; y: number };
};

export function startMoveCards(opts: {
  startX: number;
  startY: number;
  canvas: HTMLElement;
  guidesEl: HTMLElement | null;
  showGuides: () => boolean;
  moving: ReadonlyArray<{ blockId: DbId } & CardRect>;
  others: readonly CardRect[];
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  view: () => CanvasView;
  onEnd: (end: MoveCardsEnd) => void;
  onFrame?: (
    boxes: Map<DbId, CardRect>,
    world: { x: number; y: number },
    alt: boolean,
  ) => void;
  /** Fires on mouseup when the pointer never crossed the click threshold. */
  onClick?: (event: MouseEvent) => void;
}): void {
  const start = opts.pointerToWorld(opts.startX, opts.startY);
  let raf = 0;
  let lastDx = 0;
  let lastDy = 0;
  let started = false;
  let finished = false;

  const paint = (clientX: number, clientY: number, alt: boolean) => {
    raf = 0;
    const now = opts.pointerToWorld(clientX, clientY);
    const rawDx = now.x - start.x;
    const rawDy = now.y - start.y;
    const proposed = opts.moving.map((card) => ({
      x: card.x + rawDx,
      y: card.y + rawDy,
      w: card.w,
      h: card.h,
    }));
    const bounds = unionRects(proposed);
    const snap = computeSnap(
      bounds ?? { x: 0, y: 0, w: 0, h: 0 },
      opts.others,
      opts.view().scale,
      !alt,
    );
    lastDx = rawDx + snap.dx;
    lastDy = rawDy + snap.dy;
    for (const card of opts.moving) {
      applyCardBox(cardEl(opts.canvas, card.blockId), {
        x: card.x + lastDx,
        y: card.y + lastDy,
        w: card.w,
        h: card.h,
      });
    }
    if (alt || !opts.showGuides()) clearGuides(opts.guidesEl);
    else paintGuides(opts.guidesEl, snap.guides, opts.view());
    if (opts.onFrame != null) {
      const boxes = new Map<DbId, CardRect>();
      for (const card of opts.moving) {
        boxes.set(card.blockId, {
          x: card.x + lastDx,
          y: card.y + lastDy,
          w: card.w,
          h: card.h,
        });
      }
      opts.onFrame(boxes, now, alt);
    }
  };

  const detach = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    if (raf !== 0) window.cancelAnimationFrame(raf);
    raf = 0;
  };

  const finishVisual = () => {
    clearGuides(opts.guidesEl);
    for (const card of opts.moving) {
      cardEl(opts.canvas, card.blockId)?.classList.remove("is-dragging");
    }
  };

  const onMove = (event: MouseEvent) => {
    if (finished) return;
    const distX = event.clientX - opts.startX;
    const distY = event.clientY - opts.startY;
    if (
      !started &&
      distX * distX + distY * distY < CLICK_THRESHOLD_PX * CLICK_THRESHOLD_PX
    ) {
      return;
    }
    if (!started) {
      started = true;
      for (const card of opts.moving) {
        cardEl(opts.canvas, card.blockId)?.classList.add("is-dragging");
      }
    }
    if (raf === 0) {
      raf = window.requestAnimationFrame(() => {
        if (finished) return;
        paint(event.clientX, event.clientY, event.altKey);
      });
    }
  };

  const onUp = (event: MouseEvent) => {
    if (finished) return;
    finished = true;
    tracked.untrack();
    detach();
    if (started) paint(event.clientX, event.clientY, event.altKey);
    finishVisual();
    if (!started) opts.onClick?.(event);
    const moved =
      started && (lastDx !== 0 || lastDy !== 0)
        ? opts.moving.map((card) => ({
            blockId: card.blockId,
            x: card.x + lastDx,
            y: card.y + lastDy,
          }))
        : [];
    opts.onEnd({
      moves: moved,
      dragged: started,
      altKey: event.altKey,
      clientX: event.clientX,
      clientY: event.clientY,
      world: opts.pointerToWorld(event.clientX, event.clientY),
    });
  };

  const tracked = trackCardGesture(opts.canvas, () => {
    if (finished) return;
    finished = true;
    detach();
    finishVisual();
  });

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

function resizeBox(
  origin: CardRect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  lockAspect: boolean,
): CardRect {
  let left = origin.x;
  let top = origin.y;
  let right = origin.x + origin.w;
  let bottom = origin.y + origin.h;

  if (handle.includes("e")) right = origin.x + origin.w + dx;
  if (handle.includes("w")) left = origin.x + dx;
  if (handle.includes("s")) bottom = origin.y + origin.h + dy;
  if (handle.includes("n")) top = origin.y + dy;

  const clampMin = () => {
    if (right - left < MIN_CARD_WIDTH) {
      if (handle.includes("w")) left = right - MIN_CARD_WIDTH;
      else right = left + MIN_CARD_WIDTH;
    }
    if (bottom - top < MIN_CARD_HEIGHT) {
      if (handle.includes("n")) top = bottom - MIN_CARD_HEIGHT;
      else bottom = top + MIN_CARD_HEIGHT;
    }
  };
  clampMin();

  if (lockAspect && origin.h !== 0) {
    const aspect = origin.w / origin.h;
    const corner = handle.length === 2;
    if (corner) {
      let w = right - left;
      let h = bottom - top;
      if (w / h > aspect) h = w / aspect;
      else w = h * aspect;
      if (handle.includes("w")) left = right - w;
      else right = left + w;
      if (handle.includes("n")) top = bottom - h;
      else bottom = top + h;
    } else if (handle === "e" || handle === "w") {
      const w = right - left;
      const h = w / aspect;
      const cy = origin.y + origin.h / 2;
      top = cy - h / 2;
      bottom = cy + h / 2;
    } else {
      const h = bottom - top;
      const w = h * aspect;
      const cx = origin.x + origin.w / 2;
      left = cx - w / 2;
      right = cx + w / 2;
    }
    if (right - left < MIN_CARD_WIDTH || bottom - top < MIN_CARD_HEIGHT) {
      const w = Math.max(MIN_CARD_WIDTH, right - left);
      const h = Math.max(MIN_CARD_HEIGHT, w / aspect, MIN_CARD_HEIGHT);
      const width = Math.max(MIN_CARD_WIDTH, h * aspect);
      const height = width / aspect;
      if (handle.includes("w")) left = right - width;
      else right = left + width;
      if (handle.includes("n")) top = bottom - height;
      else if (handle === "e" || handle === "w") {
        const cy = origin.y + origin.h / 2;
        top = cy - height / 2;
        bottom = cy + height / 2;
      } else {
        bottom = top + height;
      }
    }
  }

  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function startResizeCard(opts: {
  handle: ResizeHandle;
  startX: number;
  startY: number;
  origin: CardRect;
  el: HTMLElement;
  blockId?: DbId;
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  onEnd: (box: CardRect) => void;
  onFrame?: (boxes: Map<DbId, CardRect>) => void;
}): void {
  const start = opts.pointerToWorld(opts.startX, opts.startY);
  let raf = 0;
  let last = { ...opts.origin };
  let finished = false;
  opts.el.classList.add("is-resizing");

  const paint = (clientX: number, clientY: number, shift: boolean) => {
    raf = 0;
    if (finished) return;
    const now = opts.pointerToWorld(clientX, clientY);
    last = resizeBox(
      opts.origin,
      opts.handle,
      now.x - start.x,
      now.y - start.y,
      shift,
    );
    applyCardBox(opts.el, last);
    if (opts.blockId != null) {
      opts.onFrame?.(new Map([[opts.blockId, last]]));
    }
  };

  const detach = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    if (raf !== 0) window.cancelAnimationFrame(raf);
    raf = 0;
  };

  const onMove = (event: MouseEvent) => {
    if (finished) return;
    if (raf === 0) {
      raf = window.requestAnimationFrame(() =>
        paint(event.clientX, event.clientY, event.shiftKey),
      );
    }
  };

  const onUp = (event: MouseEvent) => {
    if (finished) return;
    finished = true;
    tracked.untrack();
    detach();
    paint(event.clientX, event.clientY, event.shiftKey);
    opts.el.classList.remove("is-resizing");
    if (
      last.x === opts.origin.x &&
      last.y === opts.origin.y &&
      last.w === opts.origin.w &&
      last.h === opts.origin.h
    ) {
      opts.onEnd(opts.origin);
      return;
    }
    opts.onEnd(last);
  };

  const tracked = trackCardGesture(gestureRoot(opts.el) ?? opts.el, () => {
    if (finished) return;
    finished = true;
    detach();
    opts.el.classList.remove("is-resizing");
  });

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}
