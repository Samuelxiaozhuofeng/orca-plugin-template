import type { DbId } from "../orca.d.ts";
import { MIN_CARD_HEIGHT } from "./layout.ts";

export const FIT_HEIGHT_EPS = 2;

/** Vertical (or corner) resize that actually changed height should lock it. */
export function shouldLockCardHeight(
  handle: string,
  originH: number,
  nextH: number,
): boolean {
  if (handle === "e" || handle === "w") return false;
  return nextH !== originH;
}

export type FitCard = {
  blockId: DbId;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type HeightPatch = {
  blockId: DbId;
  patch: { y?: number; h?: number };
};

/**
 * Full visible body content — the flattened tree, excerpt, or hosted
 * editor. Do not use the first `.orca-block`: child rows are siblings
 * in `.owb-card-block-tree`, so that only measures the parent row.
 */
export function cardFitContentRoot(cardEl: Element): HTMLElement | null {
  const body = cardEl.querySelector(".owb-card-body");
  if (!(body instanceof HTMLElement)) return null;
  return (
    (body.querySelector(".owb-card-block-tree") as HTMLElement | null) ??
    (body.querySelector(".owb-card-excerpt") as HTMLElement | null) ??
    (body.querySelector(".owb-card-empty") as HTMLElement | null) ??
    (body.querySelector(".orca-block-editor-blocks") as HTMLElement | null) ??
    (body.querySelector(".orca-block-editor-main") as HTMLElement | null) ??
    (body.querySelector(".orca-block-editor") as HTMLElement | null) ??
    body
  );
}

function bodyPadY(body: HTMLElement): number {
  const style = getComputedStyle(body);
  return (
    (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
  );
}

/** Prefer inner children when the node is a 100%-tall editor shell. */
function innerContentSpan(el: HTMLElement): number {
  let top = Infinity;
  let bottom = -Infinity;
  for (const child of Array.from(el.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.offsetHeight <= 0 && child.scrollHeight <= 0) continue;
    top = Math.min(top, child.offsetTop);
    bottom = Math.max(bottom, child.offsetTop + child.offsetHeight);
  }
  if (!Number.isFinite(top) || bottom <= top) return 0;
  return bottom - top;
}

function contentHeight(content: HTMLElement, body: HTMLElement): number {
  const padY = bodyPadY(body);
  if (content === body) return Math.max(0, content.scrollHeight - padY);

  const isEditorShell =
    content.classList.contains("orca-block-editor") ||
    content.classList.contains("orca-block-editor-main");
  if (isEditorShell) {
    const span = innerContentSpan(content);
    if (span > 0) return span;
  }
  return content.scrollHeight;
}

export function measureCardFitHeight(cardEl: HTMLElement): number {
  const header = cardEl.querySelector(".owb-card-header");
  const body = cardEl.querySelector(".owb-card-body");
  const content = cardFitContentRoot(cardEl);
  if (!(body instanceof HTMLElement) || content == null) {
    return MIN_CARD_HEIGHT;
  }

  const padY = bodyPadY(body);
  const contentH = contentHeight(content, body);
  const borderY = Math.max(0, cardEl.offsetHeight - cardEl.clientHeight);
  const headerH =
    header instanceof HTMLElement ? header.offsetHeight : 0;
  return Math.max(
    MIN_CARD_HEIGHT,
    Math.ceil(headerH + padY + contentH + borderY),
  );
}

export function overlapsX(a: FitCard, b: FitCard): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x;
}

/**
 * Grow `sourceId` to `nextH`. Cards that share X-range and sit at or
 * below it are pushed down (with `gap`) so they do not overlap. Cards
 * further down are pushed only if the first shove would hit them.
 * Shrinking never pulls anyone back up.
 */
export function planContentHeightPatches(
  cards: readonly FitCard[],
  sourceId: DbId,
  nextH: number,
  gap: number,
): HeightPatch[] {
  const boxes: FitCard[] = cards.map((card) => ({ ...card }));
  const src = boxes.find((card) => card.blockId === sourceId);
  if (src == null) return [];

  const oldH = src.h;
  const height = Math.max(MIN_CARD_HEIGHT, nextH);
  if (Math.abs(height - oldH) < FIT_HEIGHT_EPS) return [];
  src.h = height;

  const byId = new Map<DbId, { y?: number; h?: number }>();
  byId.set(sourceId, { h: src.h });

  if (src.h > oldH) {
    const moved = new Set<DbId>([sourceId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const a of boxes) {
        if (!moved.has(a.blockId)) continue;
        for (const b of boxes) {
          if (b.blockId === a.blockId) continue;
          if (!overlapsX(a, b)) continue;
          if (b.y < a.y) continue;
          const minY = a.y + a.h + gap;
          if (b.y >= minY) continue;
          b.y = minY;
          const prev = byId.get(b.blockId) ?? {};
          byId.set(b.blockId, { ...prev, y: b.y });
          moved.add(b.blockId);
          changed = true;
        }
      }
    }
  }

  const out: HeightPatch[] = [];
  for (const card of cards) {
    const patch = byId.get(card.blockId);
    if (patch == null) continue;
    if (patch.h === card.h) delete patch.h;
    if (patch.y === card.y) delete patch.y;
    if (patch.h == null && patch.y == null) continue;
    out.push({ blockId: card.blockId, patch });
  }
  return out;
}

export function applyFitPatches<T extends FitCard>(
  cards: readonly T[],
  patches: readonly HeightPatch[],
): T[] {
  if (patches.length === 0) return cards as T[];
  const byId = new Map(patches.map((item) => [item.blockId, item.patch]));
  return cards.map((card) => {
    const patch = byId.get(card.blockId);
    return patch == null ? card : { ...card, ...patch };
  });
}
