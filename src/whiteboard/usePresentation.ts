import type { DbId } from "../orca.d.ts";
import { type WhiteboardArea } from "./areas.ts";
import type { WhiteboardKeyActions } from "./canvasKeys.ts";
import type { CanvasFocusApi } from "./cardFocus.ts";
import { MAX_SCALE } from "./layout.ts";
import type { WhiteboardCard } from "./data.ts";
import {
  buildSlides,
  clampCursor,
  revealState,
  stepCard,
  stepSlide,
  toggleZoom,
  type PresentCursor,
  type Slide,
} from "./presentation.ts";
import {
  enterPresentFullscreen,
  exitPresentFullscreen,
  onFullscreenExit,
  type FullscreenMode,
} from "./presentFullscreen.ts";
import type { CanvasView } from "./viewTransform.ts";

const { useCallback, useEffect, useMemo, useRef, useState } = window.React;

/** A presented slide or card should fill the screen, so unlike the toolbar's
 * "fit" these lift the 100% ceiling all the way to the canvas maximum. A single
 * card gets more breathing room than a whole section. */
const SLIDE_FIT = { padding: 48, maxScale: MAX_SCALE };
const CARD_FIT = { padding: 72, maxScale: MAX_SCALE };

export type PresentationState = {
  active: boolean;
  cursor: PresentCursor;
  slides: Slide[];
  reveal: { revealedIds: Set<DbId>; currentId: DbId | null } | null;
  fullscreenMode: FullscreenMode | null;
  start: () => void;
  stop: () => void;
  escape: () => void;
  toggleZoom: () => void;
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
            toggleZoom: presentation.toggleZoom,
            exit: presentation.escape,
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
  panelRef: { current: HTMLElement | null };
}): PresentationState {
  const { areas, cards, view, focusApiRef, setView, panelRef } = opts;
  const [active, setActive] = useState(false);
  const [cursor, setCursor] = useState<PresentCursor>({
    slideIndex: 0,
    cardIndex: -1,
    zoomed: false,
  });
  const [fullscreenMode, setFullscreenMode] = useState<FullscreenMode | null>(
    null,
  );
  const activeRef = useRef(active);
  activeRef.current = active;
  const fullscreenModeRef = useRef(fullscreenMode);
  fullscreenModeRef.current = fullscreenMode;

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
      if (cur.zoomed && cur.cardIndex >= 0) {
        const card = slide.cards[cur.cardIndex];
        if (card != null) {
          focusApiRef.current?.fitBoxes(
            [{ x: card.x, y: card.y, w: card.w, h: card.h }],
            CARD_FIT,
          );
        }
      } else {
        focusApiRef.current?.fitBoxes([slide.box], SLIDE_FIT);
      }
    },
    [focusApiRef],
  );

  const reveal = useMemo<{
    revealedIds: Set<DbId>;
    currentId: DbId | null;
  } | null>(() => {
    if (!active) return null;
    return revealState(cursor, slides);
  }, [active, cursor, slides]);

  const start = useCallback(() => {
    const currentSlides = slidesRef.current;
    if (currentSlides.length === 0) return;
    savedViewRef.current = viewRef.current;
    const initialCursor: PresentCursor = {
      slideIndex: 0,
      cardIndex: -1,
      zoomed: false,
    };
    cursorRef.current = initialCursor;
    setCursor(initialCursor);
    setActive(true);
    focusCurrent(initialCursor, currentSlides);
    void enterPresentFullscreen(panelRef.current).then((mode) => {
      if (!activeRef.current) {
        void exitPresentFullscreen(mode);
        return;
      }
      fullscreenModeRef.current = mode;
      setFullscreenMode(mode);
    });
  }, [focusCurrent, panelRef]);

  const stop = useCallback(() => {
    setActive(false);
    const mode = fullscreenModeRef.current;
    fullscreenModeRef.current = null;
    setFullscreenMode(null);
    if (mode != null) {
      void exitPresentFullscreen(mode);
    }
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

  // Stepping cards now zooms by default, so a layered Escape would mean two
  // presses to leave almost every time. Escape ends the slideshow; Enter is
  // what pulls back out to the whole section.
  const escape = useCallback(() => {
    stop();
  }, [stop]);

  const toggleZoomAction = useCallback(() => {
    goTo(toggleZoom(cursorRef.current, slidesRef.current));
  }, [goTo]);

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
    if (cur.slideIndex === 0 && cur.cardIndex === -1 && !cur.zoomed) return;
    goTo({ slideIndex: 0, cardIndex: -1, zoomed: false });
  }, [goTo]);

  const lastSlide = useCallback(() => {
    const lastIndex = slidesRef.current.length - 1;
    if (lastIndex < 0) return;
    const cur = cursorRef.current;
    if (cur.slideIndex === lastIndex && cur.cardIndex === -1 && !cur.zoomed) return;
    goTo({ slideIndex: lastIndex, cardIndex: -1, zoomed: false });
  }, [goTo]);

  // Only meaningful when we actually took native fullscreen: in "cover" mode
  // document.fullscreenElement is always null, so any unrelated fullscreen
  // change elsewhere in the app would read as "the user left our slideshow".
  useEffect(() => {
    if (!active || fullscreenMode !== "native") return;
    return onFullscreenExit(() => {
      stop();
    });
  }, [active, fullscreenMode, stop]);

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
    reveal,
    fullscreenMode,
    start,
    stop,
    escape,
    toggleZoom: toggleZoomAction,
    next,
    prev,
    nextCard,
    prevCard,
    firstSlide,
    lastSlide,
  };
}
