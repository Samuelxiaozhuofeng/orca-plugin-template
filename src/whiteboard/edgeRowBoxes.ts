import type { DbId } from "../orca.d.ts";
import { pickSide, type CardBox } from "./edgeGeometry.ts";
import type { Side } from "./edges.ts";

export type RowOffset = {
  relY: number;
  h: number;
};

function isValidRowBox(rowBox?: CardBox | null): rowBox is CardBox {
  return (
    rowBox != null &&
    Number.isFinite(rowBox.x) &&
    Number.isFinite(rowBox.y) &&
    Number.isFinite(rowBox.w) &&
    Number.isFinite(rowBox.h) &&
    rowBox.w > 0 &&
    rowBox.h > 0
  );
}

/**
 * Degrades to the card box if rowBox is null, undefined, or contains non-finite dimensions.
 */
export function resolveSourceBox(
  cardBox: CardBox,
  rowBox?: CardBox | null,
): CardBox {
  if (!isValidRowBox(rowBox)) {
    return cardBox;
  }
  return rowBox;
}

/**
 * Resolves source box and side for row-level connections.
 *
 * Rules:
 * 1. If rowBox is invalid, returns { box: cardBox, side: explicitSide }.
 * 2. Otherwise side = explicitSide ?? pickSide(cardBox, toBox).
 * 3. If side is "l" or "r", returns { box: rowBox, side }.
 * 4. If side is "t" or "b", returns { box: cardBox, side }.
 */
export function resolveRowAnchorBox(
  cardBox: CardBox,
  rowBox: CardBox | null | undefined,
  toBox: CardBox,
  explicitSide?: Side,
): { box: CardBox; side?: Side } {
  if (!isValidRowBox(rowBox)) {
    return { box: cardBox, side: explicitSide };
  }
  const side = explicitSide ?? pickSide(cardBox, toBox);
  if (side === "l" || side === "r") {
    return { box: rowBox, side };
  }
  return { box: cardBox, side };
}

/**
 * Measures the bounding box of a row/block inside a card relative to canvas world coordinates.
 * Returns null if the row cannot be measured, is scrolled out of the card view, or card is simplified.
 */
export function measureCardRowBox(
  canvas: HTMLElement | null,
  cardId: DbId,
  rowId: DbId,
  cardBox: CardBox,
): CardBox | null {
  if (canvas == null) return null;
  const cardEl = canvas.querySelector(`.owb-card[data-block-id="${cardId}"]`);
  if (typeof HTMLElement !== "undefined" && !(cardEl instanceof HTMLElement)) {
    return null;
  }
  if (cardEl == null || cardEl.classList?.contains("is-simplified")) return null;

  const rowEl = cardEl.querySelector(
    `.owb-card-block-node[data-owb-row-id="${rowId}"], .owb-card-block-node[data-block-id="${rowId}"]`,
  );
  if (typeof HTMLElement !== "undefined" && !(rowEl instanceof HTMLElement)) {
    return null;
  }
  if (rowEl == null) return null;

  const cardRect = cardEl.getBoundingClientRect();
  const rowRect = rowEl.getBoundingClientRect();
  if (cardRect.width <= 0 || cardRect.height <= 0 || rowRect.height <= 0) {
    return null;
  }

  // Scrolled completely out of the card's visible bounds: degrade to card box.
  if (rowRect.bottom < cardRect.top + 4 || rowRect.top > cardRect.bottom - 4) {
    return null;
  }

  const scale = cardRect.width / cardBox.w;
  if (!Number.isFinite(scale) || scale <= 0) return null;

  const relY = (rowRect.top - cardRect.top) / scale;
  const rowH = rowRect.height / scale;

  if (!Number.isFinite(relY) || !Number.isFinite(rowH) || rowH <= 0) {
    return null;
  }

  return {
    x: cardBox.x,
    y: cardBox.y + relY,
    w: cardBox.w,
    h: rowH,
  };
}

/**
 * Cache for relative row positions inside cards. During 60fps card dragging,
 * uses cached offsets to avoid per-frame DOM measurements.
 */
export class RowBoxCache {
  private offsets = new Map<string, RowOffset>();

  private key(cardId: DbId, rowId: DbId): string {
    return `${cardId}:${rowId}`;
  }

  get(cardId: DbId, rowId: DbId, cardBox: CardBox): CardBox | null {
    const offset = this.offsets.get(this.key(cardId, rowId));
    if (offset == null) return null;
    return {
      x: cardBox.x,
      y: cardBox.y + offset.relY,
      w: cardBox.w,
      h: offset.h,
    };
  }

  measure(
    canvas: HTMLElement | null,
    cardId: DbId,
    rowId: DbId,
    cardBox: CardBox,
  ): CardBox | null {
    const box = measureCardRowBox(canvas, cardId, rowId, cardBox);
    const k = this.key(cardId, rowId);
    if (box == null) {
      this.offsets.delete(k);
      return null;
    }
    const relY = box.y - cardBox.y;
    this.offsets.set(k, { relY, h: box.h });
    return box;
  }

  invalidateCard(cardId: DbId): void {
    const prefix = `${cardId}:`;
    for (const key of this.offsets.keys()) {
      if (key.startsWith(prefix)) {
        this.offsets.delete(key);
      }
    }
  }

  clear(): void {
    this.offsets.clear();
  }
}
