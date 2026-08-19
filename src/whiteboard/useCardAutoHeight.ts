import type { DbId } from "../orca.d.ts";
import { cardHasLiveGesture } from "./cardGestures";
import {
  AUTO_HEIGHT_SETTLE_MS,
  cardFitContentRoot,
  cardHasHeightCover,
  FIT_HEIGHT_EPS,
  foldAutoHeightSample,
  measureCardFitHeight,
} from "./cardFitHeight";

const { useEffect, useRef } = window.React;

type Args = {
  enabled: boolean;
  /** User-resized height: do not follow content. */
  locked?: boolean;
  /** Same flag, readable during a gesture before React re-renders. */
  lockedRef?: { current: boolean };
  cardRef: { current: HTMLElement | null };
  blockId: DbId;
  heightRef: { current: number };
  onHeight: (nextH: number, record: boolean) => void;
};

/**
 * While the card is being edited, keep its height matched to the
 * hosted note: new blocks grow the card, deleted blocks shrink it.
 * One extra measure runs after leaving edit so the read-only tree
 * does not leave a leftover gap.
 */
export function useCardAutoHeight({
  enabled,
  locked = false,
  lockedRef,
  cardRef,
  blockId,
  heightRef,
  onHeight,
}: Args): void {
  const onHeightRef = useRef(onHeight);
  onHeightRef.current = onHeight;
  const wasEnabled = useRef(enabled);
  const isLocked = () => locked || lockedRef?.current === true;

  useEffect(() => {
    const leftEdit = wasEnabled.current && !enabled;
    wasEnabled.current = enabled;
    if (!leftEdit || isLocked()) return;
    const el = cardRef.current;
    if (el == null) return;
    const timer = window.requestAnimationFrame(() => {
      if (isLocked() || cardHasLiveGesture(el)) return;
      const nextH = measureCardFitHeight(el);
      if (Math.abs(nextH - heightRef.current) < FIT_HEIGHT_EPS) return;
      onHeightRef.current(nextH, false);
    });
    return () => window.cancelAnimationFrame(timer);
  }, [blockId, cardRef, enabled, heightRef, locked]);

  useEffect(() => {
    if (!enabled || locked) return;
    const el = cardRef.current;
    if (el == null) return;

    let raf = 0;
    let settleTimer = 0;
    let pendingH: number | null = null;
    let observedRoot: HTMLElement | null = null;

    const schedule = () => {
      if (raf !== 0) return;
      raf = window.requestAnimationFrame(emit);
    };

    const ro = new ResizeObserver(schedule);
    /** False while the fade cover is up: do not measure. */
    const attachSize = (): boolean => {
      if (cardHasHeightCover(el)) {
        if (observedRoot != null) {
          ro.disconnect();
          ro.observe(el);
          observedRoot = null;
        }
        return false;
      }
      const root = cardFitContentRoot(el);
      const target = root != null && root !== el ? root : null;
      if (target === observedRoot) return true;
      ro.disconnect();
      ro.observe(el);
      if (target != null) {
        ro.observe(target);
      }
      observedRoot = target;
      return true;
    };

    const emit = () => {
      raf = 0;
      if (isLocked() || cardHasLiveGesture(el)) return;
      // Cover is still up: measuring the 100%-tall editor shell would
      // shrink then grow as Orca fills the tree. Hold the current height.
      if (!attachSize()) return;
      pendingH = foldAutoHeightSample(
        heightRef.current,
        pendingH,
        measureCardFitHeight(el),
      );
      window.clearTimeout(settleTimer);
      settleTimer = 0;
      if (pendingH == null) return;
      settleTimer = window.setTimeout(() => {
        settleTimer = 0;
        const nextH = pendingH;
        pendingH = null;
        if (nextH == null) return;
        if (isLocked() || cardHasLiveGesture(el)) return;
        if (Math.abs(nextH - heightRef.current) < FIT_HEIGHT_EPS) return;
        onHeightRef.current(nextH, false);
      }, AUTO_HEIGHT_SETTLE_MS);
    };

    const body = el.querySelector(".owb-card-body");
    const mo = new MutationObserver(() => {
      schedule();
    });
    if (body != null) {
      mo.observe(body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
    ro.observe(el);
    attachSize();
    schedule();

    return () => {
      if (raf !== 0) window.cancelAnimationFrame(raf);
      window.clearTimeout(settleTimer);
      ro.disconnect();
      mo.disconnect();
    };
  }, [blockId, cardRef, enabled, heightRef, locked]);
}
