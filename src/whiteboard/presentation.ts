import type { DbId } from "../orca.d.ts";
import { areaIsCollapsed, cardInArea, type WhiteboardArea } from "./areas.ts";
import { slideAreas } from "./areaSlides.ts";

export type SlideCard = {
  blockId: DbId;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Slide = {
  areaId: string;
  box: { x: number; y: number; w: number; h: number };
  cards: SlideCard[];
};

export type PresentCard = {
  blockId: DbId;
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * The slide sequence. Slide order comes from `slideAreas`.
 * `cards` holds the area's members (by `cardInArea`) in reading order: rows by
 * ascending y — two cards share a row when their y differ by less than half the
 * shorter card's height — then ascending x inside each row.
 * A collapsed area always gets an empty `cards`.
 */
export function buildSlides(
  areas: readonly WhiteboardArea[],
  cards: readonly PresentCard[],
): Slide[] {
  const orderedAreas = slideAreas(areas);
  const slides: Slide[] = [];

  for (const area of orderedAreas) {
    const box = { x: area.x, y: area.y, w: area.w, h: area.h };
    if (areaIsCollapsed(area)) {
      slides.push({ areaId: area.id, box, cards: [] });
      continue;
    }

    const insideCards: PresentCard[] = [];
    for (const card of cards) {
      if (cardInArea(card, area)) {
        insideCards.push(card);
      }
    }

    if (insideCards.length === 0) {
      slides.push({ areaId: area.id, box, cards: [] });
      continue;
    }

    // Sort initially by y ascending, with x ascending as tie breaker
    insideCards.sort((a, b) => a.y - b.y || a.x - b.x);

    // Group into rows based on the vertical distance threshold
    const rows: PresentCard[][] = [];
    for (const card of insideCards) {
      if (rows.length === 0) {
        rows.push([card]);
        continue;
      }
      const currentRow = rows[rows.length - 1];
      const anchor = currentRow[0];
      const threshold = Math.min(anchor.h, card.h) / 2;
      if (Math.abs(card.y - anchor.y) < threshold) {
        currentRow.push(card);
      } else {
        rows.push([card]);
      }
    }

    // Sort each row by x ascending
    const slideCards: SlideCard[] = [];
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
      for (const card of row) {
        slideCards.push({
          blockId: card.blockId,
          x: card.x,
          y: card.y,
          w: card.w,
          h: card.h,
        });
      }
    }

    slides.push({ areaId: area.id, box, cards: slideCards });
  }

  return slides;
}

/** Cursor into the sequence. `cardIndex` -1 means "frame the whole area".
 *  `zoomed` indicates whether the current card is zoomed in to fill the screen. */
export type PresentCursor = {
  slideIndex: number;
  cardIndex: number;
  zoomed: boolean;
};

/** Next / previous slide. Stops at either end, returning `cursor` itself so the
 *  caller can test for "no change" by identity. Changing slide resets the card
 *  and clears the zoomed state. */
export function stepSlide(
  cursor: PresentCursor,
  slides: readonly Slide[],
  delta: number,
): PresentCursor {
  if (slides.length === 0) return cursor;
  const nextSlideIndex = cursor.slideIndex + delta;
  if (nextSlideIndex < 0 || nextSlideIndex >= slides.length) return cursor;
  if (
    nextSlideIndex === cursor.slideIndex &&
    cursor.cardIndex === -1 &&
    !cursor.zoomed
  ) {
    return cursor;
  }
  return { slideIndex: nextSlideIndex, cardIndex: -1, zoomed: false };
}

/** Step through the current area's cards: +1 advances in cycle (-1 → 0 → … → n-1 → -1),
 *  -1 goes back in cycle (… → 0 → -1 → n-1). Never crosses into another slide;
 *  returns `cursor` itself when the area holds no cards. Stepping cards clears zoomed state. */
export function stepCard(
  cursor: PresentCursor,
  slides: readonly Slide[],
  delta: number,
): PresentCursor {
  if (slides.length === 0) return cursor;
  if (cursor.slideIndex < 0 || cursor.slideIndex >= slides.length) return cursor;
  const slide = slides[cursor.slideIndex];
  const count = slide.cards.length;
  if (count === 0) return cursor;

  let nextCardIndex: number;
  if (delta > 0) {
    nextCardIndex = cursor.cardIndex >= count - 1 ? -1 : cursor.cardIndex + 1;
  } else if (delta < 0) {
    nextCardIndex = cursor.cardIndex <= -1 ? count - 1 : cursor.cardIndex - 1;
  } else {
    return cursor;
  }

  if (nextCardIndex === cursor.cardIndex && !cursor.zoomed) return cursor;
  return { slideIndex: cursor.slideIndex, cardIndex: nextCardIndex, zoomed: false };
}

/** Enter toggles the zoom on the current card; from the whole-area view it
 *  jumps to the first card already zoomed. Null-ish cases return `cursor`. */
export function toggleZoom(
  cursor: PresentCursor,
  slides: readonly Slide[],
): PresentCursor {
  if (slides.length === 0) return cursor;
  if (cursor.slideIndex < 0 || cursor.slideIndex >= slides.length) return cursor;
  const slide = slides[cursor.slideIndex];
  if (!slide || slide.cards.length === 0) return cursor;

  if (cursor.cardIndex === -1) {
    return { slideIndex: cursor.slideIndex, cardIndex: 0, zoomed: true };
  }
  return {
    slideIndex: cursor.slideIndex,
    cardIndex: cursor.cardIndex,
    zoomed: !cursor.zoomed,
  };
}

/** Ids revealed so far on the current slide, plus which one is current.
 *  Null when nothing is being revealed (cardIndex === -1), which means
 *  "show every card normally". */
export function revealState(
  cursor: PresentCursor,
  slides: readonly Slide[],
): { revealedIds: Set<DbId>; currentId: DbId | null } | null {
  if (cursor.cardIndex === -1) return null;
  if (slides.length === 0) return null;
  if (cursor.slideIndex < 0 || cursor.slideIndex >= slides.length) return null;
  const slide = slides[cursor.slideIndex];
  if (!slide || slide.cards.length === 0) return null;

  const revealedIds = new Set<DbId>();
  const limit = Math.min(cursor.cardIndex, slide.cards.length - 1);
  for (let i = 0; i <= limit; i++) {
    revealedIds.add(slide.cards[i].blockId);
  }
  const currentCard = slide.cards[cursor.cardIndex];
  const currentId = currentCard ? currentCard.blockId : null;
  return { revealedIds, currentId };
}

/** Clamp the cursor back into range after slides or cards disappear.
 *  Returns `cursor` itself when nothing moved, or null when the sequence is empty. */
export function clampCursor(
  cursor: PresentCursor,
  slides: readonly Slide[],
): PresentCursor | null {
  if (slides.length === 0) return null;
  const slideIndex = Math.max(
    0,
    Math.min(cursor.slideIndex, slides.length - 1),
  );
  const slide = slides[slideIndex];
  const cardCount = slide.cards.length;
  const cardIndex =
    cardCount === 0
      ? -1
      : Math.max(-1, Math.min(cursor.cardIndex, cardCount - 1));
  const zoomed = cardIndex === -1 ? false : cursor.zoomed;

  if (
    cursor.slideIndex === slideIndex &&
    cursor.cardIndex === cardIndex &&
    cursor.zoomed === zoomed
  ) {
    return cursor;
  }
  return { slideIndex, cardIndex, zoomed };
}

