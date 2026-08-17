import type { DbId } from "../orca.d.ts";
import { type WhiteboardArea } from "./areas.ts";
import type { WhiteboardKeyActions } from "./canvasKeys.ts";
import type { CanvasFocusApi } from "./cardFocus.ts";
import type { WhiteboardCard } from "./data.ts";
import {
  buildSlides,
  clampCursor,
  stepCard,
  stepSlide,
  type PresentCursor,
  type Slide,
} from "./presentation.ts";
import type { CanvasView } from "./viewTransform.ts";

const { useCallback, useEffect, useMemo, useRef, useState } = window.React;

export type PresentationState = {
  active: boolean;
  cursor: PresentCursor;
  slides: Slide[];
  focusCardId: DbId | null;
  start: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  nextCard: () => void;
  prevCard: () => void;
  firstSlide: () => void;
  lastSlide: () => void;
};

/** The slice of a live presentation the canvas keyboard needs.
 * Undefined while no slideshow is running, which is what switches the
 * presentation key branch off. */
export function usePresentKeyActions(
  presenting: boolean,
  presentation: PresentationState | undefined,
): WhiteboardKeyActions["present"] {
  return useMemo(
    () =>
      presenting && presentation
        ? {
            next: presentation.next,
            prev: presentation.prev,
            nextCard: presentation.nextCard,
            prevCard: presentation.prevCard,
            exit: presentation.stop,
            firstSlide: presentation.firstSlide,
            lastSlide: presentation.lastSlide,
          }
        : undefined,
    [presenting, presentation],
  );
}

export function usePresentation(opts: {
  areas: readonly WhiteboardArea[];
  cards: readonly WhiteboardCard[];
  view: CanvasView;
  focusApiRef: { current: CanvasFocusApi | null };
  setView: (view: CanvasView) => void;
}): PresentationState {
  const { areas, cards, view, focusApiRef, setView } = opts;
  const [active, setActive] = useState(false);
  const [cursor, setCursor] = useState<PresentCursor>({
    slideIndex: 0,
    cardIndex: -1,
  });
  const savedViewRef = useRef<CanvasView | null>(null);
  const slides = useMemo(() => buildSlides(areas, cards), [areas, cards]);
  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const viewRef = useRef(view);
  viewRef.current = view;

  const focusCurrent = useCallback(
    (cur: PresentCursor, currentSlides: readonly Slide[]) => {
      const slide = currentSlides[cur.slideIndex];
      if (!slide) return;
      if (cur.cardIndex === -1) {
        focusApiRef.current?.fitBoxes([slide.box]);
      } else {
        const card = slide.cards[cur.cardIndex];
        if (card != null) {
          focusApiRef.current?.fitBoxes([
            { x: card.x, y: card.y, w: card.w, h: card.h },
          ]);
        }
      }
    },
    [focusApiRef],
  );

  const focusCardId = useMemo<DbId | null>(() => {
    if (!active || cursor.cardIndex < 0) return null;
    const currentSlide = slides[cursor.slideIndex];
    if (!currentSlide) return null;
    const card = currentSlide.cards[cursor.cardIndex];
    return card ? card.blockId : null;
  }, [active, cursor, slides]);

  const start = useCallback(() => {
    const currentSlides = slidesRef.current;
    if (currentSlides.length === 0) return;
    savedViewRef.current = viewRef.current;
    const initialCursor = { slideIndex: 0, cardIndex: -1 };
    cursorRef.current = initialCursor;
    setCursor(initialCursor);
    setActive(true);
    focusCurrent(initialCursor, currentSlides);
  }, [focusCurrent]);

  const stop = useCallback(() => {
    setActive(false);
    if (savedViewRef.current != null) {
      setView(savedViewRef.current);
    }
  }, [setView]);

  /** Single place where a new cursor is committed: state, then camera.
   * Kept out of the `setCursor` updater — updaters must stay side-effect free. */
  const goTo = useCallback(
    (nextCur: PresentCursor) => {
      const currentSlides = slidesRef.current;
      if (nextCur === cursorRef.current) return;
      cursorRef.current = nextCur;
      setCursor(nextCur);
      focusCurrent(nextCur, currentSlides);
    },
    [focusCurrent],
  );

  const next = useCallback(() => {
    goTo(stepSlide(cursorRef.current, slidesRef.current, 1));
  }, [goTo]);

  const prev = useCallback(() => {
    goTo(stepSlide(cursorRef.current, slidesRef.current, -1));
  }, [goTo]);

  const nextCard = useCallback(() => {
    goTo(stepCard(cursorRef.current, slidesRef.current, 1));
  }, [goTo]);

  const prevCard = useCallback(() => {
    goTo(stepCard(cursorRef.current, slidesRef.current, -1));
  }, [goTo]);

  const firstSlide = useCallback(() => {
    if (slidesRef.current.length === 0) return;
    const cur = cursorRef.current;
    if (cur.slideIndex === 0 && cur.cardIndex === -1) return;
    goTo({ slideIndex: 0, cardIndex: -1 });
  }, [goTo]);

  const lastSlide = useCallback(() => {
    const lastIndex = slidesRef.current.length - 1;
    if (lastIndex < 0) return;
    const cur = cursorRef.current;
    if (cur.slideIndex === lastIndex && cur.cardIndex === -1) return;
    goTo({ slideIndex: lastIndex, cardIndex: -1 });
  }, [goTo]);

  useEffect(() => {
    if (!active) return;
    if (slides.length === 0) {
      stop();
      return;
    }
    const clamped = clampCursor(cursor, slides);
    if (clamped == null) {
      stop();
    } else if (clamped !== cursor) {
      setCursor(clamped);
      focusCurrent(clamped, slides);
    }
  }, [active, cursor, focusCurrent, slides, stop]);

  return {
    active,
    cursor,
    slides,
    focusCardId,
    start,
    stop,
    next,
    prev,
    nextCard,
    prevCard,
    firstSlide,
    lastSlide,
  };
}
