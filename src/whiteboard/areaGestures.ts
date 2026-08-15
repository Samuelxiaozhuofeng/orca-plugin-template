import { MIN_AREA_H, MIN_AREA_W } from "./areas";
import { CLICK_THRESHOLD_PX } from "./marquee";
import { normalizeRect, type CardRect } from "./selection";

export type AreaCorner = "nw" | "ne" | "se" | "sw";

export const AREA_CORNERS: AreaCorner[] = ["nw", "ne", "se", "sw"];

export function applyAreaBox(el: HTMLElement | null, box: CardRect): void {
  if (el == null) return;
  el.style.left = `${box.x}px`;
  el.style.top = `${box.y}px`;
  el.style.width = `${box.w}px`;
  el.style.height = `${box.h}px`;
}

export function paintAreaGhost(
  el: HTMLElement | null,
  rect: CardRect | null,
): void {
  if (el == null) return;
  if (rect == null || (rect.w < 1 && rect.h < 1)) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  applyAreaBox(el, rect);
}

type TrackedGesture = {
  abort: () => void;
  untrack: () => void;
};

const areaGestureBuckets = new WeakMap<object, Set<TrackedGesture>>();

function trackAreaGesture(root: object, onAbort: () => void): TrackedGesture {
  let open = true;
  let bucket = areaGestureBuckets.get(root);
  if (bucket == null) {
    bucket = new Set();
    areaGestureBuckets.set(root, bucket);
  }
  const entry: TrackedGesture = {
    abort() {
      if (!open) return;
      open = false;
      bucket!.delete(entry);
      onAbort();
    },
    untrack() {
      if (!open) return;
      open = false;
      bucket!.delete(entry);
    },
  };
  bucket.add(entry);
  return entry;
}

export function abortAreaGestures(root: object | null | undefined): void {
  if (root == null) return;
  const bucket = areaGestureBuckets.get(root);
  if (bucket == null) return;
  for (const entry of [...bucket]) entry.abort();
}

function resizeAreaBox(
  origin: CardRect,
  handle: AreaCorner,
  dx: number,
  dy: number,
): CardRect {
  let left = origin.x;
  let top = origin.y;
  let right = origin.x + origin.w;
  let bottom = origin.y + origin.h;
  if (handle.includes("e")) right = origin.x + origin.w + dx;
  if (handle.includes("w")) left = origin.x + dx;
  if (handle.includes("s")) bottom = origin.y + origin.h + dy;
  if (handle.includes("n")) top = origin.y + dy;
  if (right - left < MIN_AREA_W) {
    if (handle.includes("w")) left = right - MIN_AREA_W;
    else right = left + MIN_AREA_W;
  }
  if (bottom - top < MIN_AREA_H) {
    if (handle.includes("n")) top = bottom - MIN_AREA_H;
    else bottom = top + MIN_AREA_H;
  }
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function startDrawArea(opts: {
  startX: number;
  startY: number;
  canvas: HTMLElement;
  ghostEl: HTMLElement;
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  onCancel: () => void;
  onEnd: (box: CardRect) => void;
}): void {
  const start = opts.pointerToWorld(opts.startX, opts.startY);
  let raf = 0;
  let finished = false;
  let last = { x: opts.startX, y: opts.startY };

  const paint = () => {
    raf = 0;
    if (finished) return;
    const now = opts.pointerToWorld(last.x, last.y);
    paintAreaGhost(opts.ghostEl, normalizeRect(start.x, start.y, now.x, now.y));
  };

  const detach = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    if (raf !== 0) window.cancelAnimationFrame(raf);
    raf = 0;
  };

  const finishVisual = () => {
    paintAreaGhost(opts.ghostEl, null);
  };

  const onMove = (event: MouseEvent) => {
    if (finished) return;
    last = { x: event.clientX, y: event.clientY };
    if (raf === 0) raf = window.requestAnimationFrame(paint);
  };

  const onUp = (event: MouseEvent) => {
    if (finished) return;
    finished = true;
    tracked.untrack();
    detach();
    finishVisual();
    const dx = event.clientX - opts.startX;
    const dy = event.clientY - opts.startY;
    if (dx * dx + dy * dy < CLICK_THRESHOLD_PX * CLICK_THRESHOLD_PX) {
      opts.onCancel();
      return;
    }
    const now = opts.pointerToWorld(event.clientX, event.clientY);
    const box = normalizeRect(start.x, start.y, now.x, now.y);
    if (box.w < MIN_AREA_W || box.h < MIN_AREA_H) {
      opts.onCancel();
      return;
    }
    opts.onEnd(box);
  };

  const tracked = trackAreaGesture(opts.canvas, () => {
    if (finished) return;
    finished = true;
    detach();
    finishVisual();
    opts.onCancel();
  });

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

export function startResizeArea(opts: {
  handle: AreaCorner;
  startX: number;
  startY: number;
  origin: CardRect;
  el: HTMLElement;
  canvas: HTMLElement;
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  onEnd: (box: CardRect) => void;
}): void {
  const start = opts.pointerToWorld(opts.startX, opts.startY);
  let raf = 0;
  let last = { ...opts.origin };
  let finished = false;
  opts.el.classList.add("is-resizing");

  const paint = (clientX: number, clientY: number) => {
    raf = 0;
    if (finished) return;
    const now = opts.pointerToWorld(clientX, clientY);
    last = resizeAreaBox(opts.origin, opts.handle, now.x - start.x, now.y - start.y);
    applyAreaBox(opts.el, last);
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
        paint(event.clientX, event.clientY),
      );
    }
  };

  const onUp = (event: MouseEvent) => {
    if (finished) return;
    finished = true;
    tracked.untrack();
    detach();
    paint(event.clientX, event.clientY);
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

  const tracked = trackAreaGesture(opts.canvas, () => {
    if (finished) return;
    finished = true;
    detach();
    applyAreaBox(opts.el, opts.origin);
    opts.el.classList.remove("is-resizing");
  });

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}
