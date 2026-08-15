import type { DbId } from "../orca.d.ts";
import { cardHasLiveGesture } from "./cardGestures";
import {
  cardFitContentRoot,
  FIT_HEIGHT_EPS,
  measureCardFitHeight,
} from "./cardFitHeight";

const { useEffect, useRef } = window.React;

type Args = {
  enabled: boolean;
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
  cardRef,
  blockId,
  heightRef,
  onHeight,
}: Args): void {
  const onHeightRef = useRef(onHeight);
  onHeightRef.current = onHeight;
  const wasEnabled = useRef(enabled);

  useEffect(() => {
    const leftEdit = wasEnabled.current && !enabled;
    wasEnabled.current = enabled;
    if (!leftEdit) return;
    const el = cardRef.current;
    if (el == null) return;
    const timer = window.requestAnimationFrame(() => {
      if (cardHasLiveGesture(el)) return;
      const nextH = measureCardFitHeight(el);
      if (Math.abs(nextH - heightRef.current) < FIT_HEIGHT_EPS) return;
      onHeightRef.current(nextH, false);
    });
    return () => window.cancelAnimationFrame(timer);
  }, [blockId, cardRef, enabled, heightRef]);

  useEffect(() => {
    if (!enabled) return;
    const el = cardRef.current;
    if (el == null) return;

    let raf = 0;
    const emit = () => {
      raf = 0;
      if (cardHasLiveGesture(el)) return;
      const nextH = measureCardFitHeight(el);
      if (Math.abs(nextH - heightRef.current) < FIT_HEIGHT_EPS) return;
      onHeightRef.current(nextH, false);
    };
    const schedule = () => {
      if (raf !== 0) return;
      raf = window.requestAnimationFrame(emit);
    };

    const ro = new ResizeObserver(schedule);
    const attachSize = () => {
      ro.disconnect();
      ro.observe(el);
      const root = cardFitContentRoot(el);
      if (root != null) ro.observe(root);
      for (const node of el.querySelectorAll(
        ".owb-card-block-node, .orca-block, .orca-block-editor-blocks",
      )) {
        ro.observe(node);
      }
    };

    const body = el.querySelector(".owb-card-body");
    const mo = new MutationObserver(() => {
      attachSize();
      schedule();
    });
    if (body != null) {
      mo.observe(body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
    attachSize();
    schedule();

    return () => {
      if (raf !== 0) window.cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
    };
  }, [blockId, cardRef, enabled, heightRef]);
}
