import {
  CARD_WIDTH,
  MIN_CARD_HEIGHT,
  MIN_CARD_WIDTH,
} from "./layout.ts";

export type MediaCardKind = "image" | "video" | "audio" | "pdf" | "epub";

export const MEDIA_CARD_KINDS: readonly MediaCardKind[] = [
  "image",
  "video",
  "audio",
  "pdf",
  "epub",
];

/** Same width as ordinary cards so layout / snap stay aligned. */
export const MEDIA_CARD_WIDTH = CARD_WIDTH;

/**
 * Height of the title strip a video card reserves above its player, so the
 * title never lands on top of the video when the frame appears on hover.
 * Mirrored by `--owb-media-header-h` in mediaCardStyles.
 */
export const MEDIA_CARD_HEADER_H = 36;
/** 16:9 frame plus the reserved title strip. */
export const MEDIA_CARD_HEIGHT_VIDEO = 191 + MEDIA_CARD_HEADER_H;
/** 4:3 fallback when the image ratio is unknown. */
export const MEDIA_CARD_HEIGHT_IMAGE = 255;
/** Single-row player. Clamped up to MIN_CARD_HEIGHT when applied. */
export const MEDIA_CARD_HEIGHT_AUDIO = 96;
/** Portrait cover. */
export const MEDIA_CARD_HEIGHT_PDF = 440;
/** Portrait cover. */
export const MEDIA_CARD_HEIGHT_EPUB = 440;

const MEDIA_CARD_HEIGHT: Record<MediaCardKind, number> = {
  image: MEDIA_CARD_HEIGHT_IMAGE,
  video: MEDIA_CARD_HEIGHT_VIDEO,
  audio: MEDIA_CARD_HEIGHT_AUDIO,
  pdf: MEDIA_CARD_HEIGHT_PDF,
  epub: MEDIA_CARD_HEIGHT_EPUB,
};

const MEDIA_KIND_SET = new Set<string>(MEDIA_CARD_KINDS);

function asMediaKind(value: unknown): MediaCardKind | null {
  if (typeof value !== "string") return null;
  const key = value.toLowerCase();
  return MEDIA_KIND_SET.has(key) ? (key as MediaCardKind) : null;
}

function typeOfRepr(value: unknown): string | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const type = (value as { type?: unknown }).type;
  return typeof type === "string" ? type : null;
}

/**
 * Read a block's `_repr.type` if this is a media block.
 * Accepts `_repr` on the object or as a `properties` entry.
 * Anything missing / malformed is not media — never throws.
 */
export function mediaKindOfBlock(block: unknown): MediaCardKind | null {
  try {
    if (block == null || typeof block !== "object") return null;
    const rec = block as { _repr?: unknown; properties?: unknown };
    const directType = typeOfRepr(rec._repr);
    if (directType != null) return asMediaKind(directType);
    const props = rec.properties;
    if (!Array.isArray(props)) return null;
    for (const prop of props) {
      if (prop == null || typeof prop !== "object") continue;
      if ((prop as { name?: unknown }).name !== "_repr") continue;
      return asMediaKind(typeOfRepr((prop as { value?: unknown }).value));
    }
    return null;
  } catch {
    return null;
  }
}

export type MediaBlockLookup = {
  readonly [id: number]: unknown;
};

function hasOwnContent(block: unknown): boolean {
  if (block == null || typeof block !== "object") return false;
  const rec = block as { text?: unknown; content?: unknown; children?: unknown };
  if (typeof rec.text === "string" && rec.text.trim().length > 0) return true;
  if (Array.isArray(rec.content) && rec.content.length > 0) return true;
  // A child that only carries children of its own still counts as content.
  return Array.isArray(rec.children) && rec.children.length > 0;
}

/**
 * True when a media block carries child blocks that actually hold something.
 * Such a block is more note than media, so it keeps ordinary card chrome.
 * Empty placeholder children (created and never filled) do not count.
 */
export function mediaBlockHasContentChildren(
  block: unknown,
  blocks: MediaBlockLookup | null | undefined,
): boolean {
  try {
    if (block == null || typeof block !== "object") return false;
    const children = (block as { children?: unknown }).children;
    if (!Array.isArray(children) || children.length === 0) return false;
    if (blocks == null || typeof blocks !== "object") return false;
    return children.some((id) => {
      const childId = Number(id);
      if (!Number.isFinite(childId)) return false;
      return hasOwnContent(blocks[childId]);
    });
  } catch {
    return false;
  }
}

/**
 * The media kind a *card* should render as. Null means "render as an ordinary
 * card": either the block is not media, or it has real child content below the
 * media, which needs the normal frame and title.
 */
export function mediaCardKindOf(
  blockId: number,
  blocks: MediaBlockLookup | null | undefined,
): MediaCardKind | null {
  const block = blocks?.[blockId];
  const kind = mediaKindOfBlock(block);
  if (kind == null) return null;
  return mediaBlockHasContentChildren(block, blocks) ? null : kind;
}

/** Blocks whose changes can flip `mediaCardKindOf` for this card. */
export function mediaCardWatchIds(
  blockId: number,
  blocks: MediaBlockLookup | null | undefined,
): number[] {
  const ids = [blockId];
  try {
    const children = (blocks?.[blockId] as { children?: unknown } | undefined)
      ?.children;
    if (Array.isArray(children)) {
      for (const id of children) {
        const childId = Number(id);
        if (Number.isFinite(childId)) ids.push(childId);
      }
    }
  } catch {
    // Fall back to watching the root alone.
  }
  return ids;
}

export function mediaCardSize(kind: MediaCardKind): { w: number; h: number } {
  const suggested = MEDIA_CARD_HEIGHT[kind] ?? MIN_CARD_HEIGHT;
  return {
    w: Math.max(MIN_CARD_WIDTH, MEDIA_CARD_WIDTH),
    h: Math.max(MIN_CARD_HEIGHT, suggested),
  };
}
