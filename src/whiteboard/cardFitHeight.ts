import type { DbId } from "../orca.d.ts";
import { MIN_CARD_HEIGHT } from "./layout.ts";

export const FIT_HEIGHT_EPS = 2;

/**
 * While the hosted editor is still growing its tree, wait this long
 * after the last height sample before writing. Consecutive frames of
 * incremental mount then become one patch instead of one per frame.
 */
export const AUTO_HEIGHT_SETTLE_MS = 180;

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

/** Read-only tree kept on top while the hosted editor mounts. */
export const CARD_TREE_OVERLAY_CLASS = "owb-card-tree-overlay";

/** True while the fade cover is still sitting on the mounting editor. */
export function cardHasHeightCover(cardEl: Element): boolean {
  return (
    cardEl.querySelector(
      `.owb-card-block-tree.${CARD_TREE_OVERLAY_CLASS}`,
    ) != null
  );
}

/**
 * Fold one measured height into the pending value. `null` means the
 * sample matches the committed height — drop any pending write.
 */
export function foldAutoHeightSample(
  committed: number,
  pending: number | null,
  sample: number,
  eps: number = FIT_HEIGHT_EPS,
): number | null {
  if (Math.abs(sample - committed) < eps) return null;
  if (pending != null && Math.abs(sample - pending) < eps) return pending;
  return sample;
}

export type CardFitRootKind =
  | "tree"
  | "excerpt"
  | "empty"
  | "editor-blocks"
  | "editor-main"
  | "editor"
  | "body";

export type CardFitRootFlags = {
  liveTree: boolean;
  overlayTree: boolean;
  excerpt: boolean;
  empty: boolean;
  editorBlocks: boolean;
  editorMain: boolean;
  editor: boolean;
};

/**
 * Which box should drive auto-height. An overlay tree is a fade cover,
 * not the live content — if we measured it (or an empty editor shell
 * sitting under it) the card would jump. Prefer the body in that
 * window so height stays put until the overlay is gone.
 */
export function chooseCardFitRootKind(flags: CardFitRootFlags): CardFitRootKind {
  if (flags.liveTree) return "tree";
  if (flags.excerpt) return "excerpt";
  if (flags.empty) return "empty";
  if (flags.overlayTree) return "body";
  if (flags.editorBlocks) return "editor-blocks";
  if (flags.editorMain) return "editor-main";
  if (flags.editor) return "editor";
  return "body";
}

/**
 * Full visible body content — the flattened tree, excerpt, or hosted
 * editor. Do not use the first `.orca-block`: child rows are siblings
 * in `.owb-card-block-tree`, so that only measures the parent row.
 */
export function cardFitContentRoot(cardEl: Element): HTMLElement | null {
  const body = cardEl.querySelector(".owb-card-body");
  if (!(body instanceof HTMLElement)) return null;
  const liveTree = body.querySelector(
    `.owb-card-block-tree:not(.${CARD_TREE_OVERLAY_CLASS})`,
  );
  const overlayTree = body.querySelector(
    `.owb-card-block-tree.${CARD_TREE_OVERLAY_CLASS}`,
  );
  const excerpt = body.querySelector(".owb-card-excerpt");
  const empty = body.querySelector(".owb-card-empty");
  const editorBlocks = body.querySelector(".orca-block-editor-blocks");
  const editorMain = body.querySelector(".orca-block-editor-main");
  const editor = body.querySelector(".orca-block-editor");
  const kind = chooseCardFitRootKind({
    liveTree: liveTree instanceof HTMLElement,
    overlayTree: overlayTree instanceof HTMLElement,
    excerpt: excerpt instanceof HTMLElement,
    empty: empty instanceof HTMLElement,
    editorBlocks: editorBlocks instanceof HTMLElement,
    editorMain: editorMain instanceof HTMLElement,
    editor: editor instanceof HTMLElement,
  });
  switch (kind) {
    case "tree":
      return liveTree instanceof HTMLElement ? liveTree : body;
    case "excerpt":
      return excerpt instanceof HTMLElement ? excerpt : body;
    case "empty":
      return empty instanceof HTMLElement ? empty : body;
    case "editor-blocks":
      return editorBlocks instanceof HTMLElement ? editorBlocks : body;
    case "editor-main":
      return editorMain instanceof HTMLElement ? editorMain : body;
    case "editor":
      return editor instanceof HTMLElement ? editor : body;
    case "body":
      return body;
  }
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
