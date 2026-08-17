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

/** 16:9 frame. */
export const MEDIA_CARD_HEIGHT_VIDEO = 191;
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

export function mediaCardSize(kind: MediaCardKind): { w: number; h: number } {
  const suggested = MEDIA_CARD_HEIGHT[kind] ?? MIN_CARD_HEIGHT;
  return {
    w: Math.max(MIN_CARD_WIDTH, MEDIA_CARD_WIDTH),
    h: Math.max(MIN_CARD_HEIGHT, suggested),
  };
}
