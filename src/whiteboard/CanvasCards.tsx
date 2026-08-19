import type { DbId } from "../orca.d.ts";
import { Card } from "./Card";
import type { WhiteboardCard } from "./data";
import type { CardBox } from "./edgeGeometry";
import type { ArrangeAction } from "./selection";
import type { CardPatchEntry } from "./useCanvasPointer";
import type { EdgeLayerApi } from "./EdgeLayer";
import { cardIdsKey } from "./cardExtract";
import { cardTreeLoadIds, useVisibleCardTrees } from "./cardTreeLoad";
import { isWhiteboardBlock } from "./pageBoardPlan";
import { useWhiteboardSettings } from "./settings";
import { isWhiteboardGestureActive } from "./hoverPreview";
import {
  initialEditorPrewarmState,
  PREWARM_DISCARD_GRACE_MS,
  PREWARM_HOVER_DELAY_MS,
  prewarmedCardId,
  stepEditorPrewarm,
  type EditorPrewarmEvent,
  type EditorPrewarmState,
} from "./editorPrewarm";

const { useCallback, useEffect, useRef, useState } = window.React;

function useCardEditorPrewarmRuntime(
  enabled: boolean,
  anyEditing: boolean,
): {
  activePrewarmedId: DbId | null;
  onCardEnter: (
    card: WhiteboardCard,
    simplified: boolean,
    el: HTMLElement,
  ) => void;
  onCardLeave: (card: WhiteboardCard) => void;
} {
  const [state, setState] = useState<EditorPrewarmState>(
    initialEditorPrewarmState,
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const anyEditingRef = useRef(anyEditing);
  anyEditingRef.current = anyEditing;

  const viewportRef = useRef<Element | null>(null);
  const mountedRef = useRef(true);

  const dispatch = useCallback((event: EditorPrewarmEvent) => {
    const next = stepEditorPrewarm(stateRef.current, event);
    if (
      next.phase !== stateRef.current.phase ||
      next.cardId !== stateRef.current.cardId ||
      next.since !== stateRef.current.since
    ) {
      stateRef.current = next;
      if (next.phase === "idle") viewportRef.current = null;
      if (mountedRef.current) setState(next);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // When gates change, reset to idle if prewarming was active or pending
  useEffect(() => {
    if (state.phase !== "idle" && (!enabled || anyEditing)) {
      dispatch({ type: "block" });
    }
  }, [enabled, anyEditing, state.phase, dispatch]);

  // Timers for pending (hover delay) and leaving (grace period)
  useEffect(() => {
    if (
      state.phase === "idle" ||
      state.phase === "ready" ||
      state.cardId == null
    ) {
      return;
    }

    let delay = 0;
    if (state.phase === "pending") {
      delay = Math.max(0, PREWARM_HOVER_DELAY_MS - (Date.now() - state.since));
    } else if (state.phase === "leaving") {
      delay = Math.max(0, PREWARM_DISCARD_GRACE_MS - (Date.now() - state.since));
    }

    const timer = window.setTimeout(() => {
      dispatch({
        type: "tick",
        at: Date.now(),
        enabled: enabledRef.current,
        anyEditing: anyEditingRef.current,
        gestureActive: isWhiteboardGestureActive(viewportRef.current),
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [state.phase, state.cardId, state.since, dispatch]);

  // Wheel (this board only) and class-stamped gestures while not idle
  useEffect(() => {
    if (state.phase === "idle") return;

    const onWheel = (event: WheelEvent) => {
      const viewport = viewportRef.current;
      if (viewport == null) return;
      const target = event.target;
      if (target instanceof Node && viewport.contains(target)) {
        dispatch({ type: "block" });
      }
    };

    window.addEventListener("wheel", onWheel, {
      capture: true,
      passive: true,
    });

    let observer: MutationObserver | null = null;
    const viewport = viewportRef.current;
    if (viewport != null) {
      if (isWhiteboardGestureActive(viewport)) {
        dispatch({ type: "block" });
      } else {
        observer = new MutationObserver(() => {
          if (isWhiteboardGestureActive(viewport)) {
            dispatch({ type: "block" });
          }
        });
        observer.observe(viewport, {
          attributes: true,
          attributeFilter: ["class"],
          subtree: true,
        });
      }
    }

    return () => {
      window.removeEventListener("wheel", onWheel, { capture: true });
      observer?.disconnect();
    };
  }, [state.phase, dispatch]);

  const onCardEnter = useCallback(
    (card: WhiteboardCard, simplified: boolean, el: HTMLElement) => {
      if (isWhiteboardBlock(orca.state.blocks[card.blockId])) return;
      if (simplified) return;
      viewportRef.current = el.closest(".owb-viewport") ?? el;
      dispatch({
        type: "enter",
        cardId: card.blockId,
        at: Date.now(),
        enabled: enabledRef.current,
        anyEditing: anyEditingRef.current,
        gestureActive: isWhiteboardGestureActive(viewportRef.current),
      });
    },
    [dispatch],
  );

  const onCardLeave = useCallback(
    (card: WhiteboardCard) => {
      if (stateRef.current.cardId === card.blockId) {
        dispatch({
          type: "leave",
          at: Date.now(),
        });
      }
    },
    [dispatch],
  );

  return {
    activePrewarmedId: prewarmedCardId(state),
    onCardEnter,
    onCardLeave,
  };
}

type Props = {
  panelId: string;
  cards: WhiteboardCard[];
  shownCards: WhiteboardCard[];
  lodSimplified: boolean;
  editingId: DbId | null;
  selected: DbId[];
  selectedSet: Set<DbId>;
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  selectCards: (ids: DbId[]) => void;
  selectEdge: (id: string | null) => void;
  startEdit: (blockId: DbId) => void;
  endEdit: () => void;
  onCardMouseDown: (
    event: React.MouseEvent<HTMLDivElement>,
    card: WhiteboardCard,
  ) => void;
  onPatchCards: (entries: CardPatchEntry[]) => void;
  onContentHeight: (blockId: DbId, nextH: number, record: boolean) => void;
  applyArrange: (action: ArrangeAction) => void;
  onMoveFrame: (boxes: Map<DbId, CardBox>) => void;
  edgeApiRef: { current: EdgeLayerApi | null };
  onExtractRow: (blockId: DbId, sourceCard: WhiteboardCard) => void;
  onWrapSelected: () => void;
  onFocusCard: (blockId: DbId) => void;
  presentReveal?: { revealedIds: ReadonlySet<DbId>; currentId: DbId | null } | null;
  highlightedRowIds?: ReadonlySet<DbId>;
};

export function CanvasCards({
  panelId,
  cards,
  shownCards,
  lodSimplified,
  editingId,
  selected,
  selectedSet,
  pointerToWorld,
  selectCards,
  selectEdge,
  startEdit,
  endEdit,
  onCardMouseDown,
  onPatchCards,
  onContentHeight,
  applyArrange,
  onMoveFrame,
  edgeApiRef,
  onExtractRow,
  onWrapSelected,
  onFocusCard,
  presentReveal,
  highlightedRowIds,
}: Props) {
  const settings = useWhiteboardSettings();
  const { activePrewarmedId, onCardEnter, onCardLeave } =
    useCardEditorPrewarmRuntime(
      settings.prewarmCardEditor,
      editingId != null,
    );

  const promotedKey = cardIdsKey(cards);
  const cardTrees = useVisibleCardTrees(
    cardTreeLoadIds(shownCards, {
      simplified: lodSimplified,
      keep: editingId,
      // Only skip roots already loaded *and* confirmed as whiteboards.
      // An unloaded block makes isWhiteboardBlock false, so it still loads.
      skip: (id) => isWhiteboardBlock(orca.state.blocks[id]),
    }),
    promotedKey,
  );

  return (
    <>
      {shownCards.map((card: WhiteboardCard) => {
        const isSimplified = lodSimplified && editingId !== card.blockId;
        return (
          <Card
            key={card.blockId}
            panelId={panelId}
            card={card}
            treeRev={cardTrees.revByRoot[card.blockId] ?? 0}
            loadRetrying={cardTrees.retryingRootSet.has(card.blockId)}
            onRetryLoad={cardTrees.retryRoot}
            editing={editingId === card.blockId}
            prewarming={activePrewarmedId === card.blockId}
            onHoverEnter={(el) => onCardEnter(card, isSimplified, el)}
            onHoverLeave={() => onCardLeave(card)}
            simplified={isSimplified}
            selected={selectedSet.has(card.blockId)}
            showResize={
              selected.length === 0 ||
              (selected.length === 1 && selectedSet.has(card.blockId))
            }
            onSelectOnly={(blockId) => selectCards([blockId])}
            selectedCount={selected.length}
            pointerToWorld={pointerToWorld}
            onStartEdit={startEdit}
            onEndEdit={endEdit}
            onCardMouseDown={(event, card) => {
              selectEdge(null);
              onCardMouseDown(event, card);
            }}
            onPatchCard={(blockId, patch) =>
              onPatchCards([{ blockId, patch }])
            }
            onContentHeight={onContentHeight}
            onArrange={applyArrange}
            onMoveFrame={onMoveFrame}
            onStartConnect={(
              card: WhiteboardCard,
              event: React.MouseEvent,
              mode: "drag" | "click",
              fromBlock?: DbId,
            ) => {
              edgeApiRef.current?.startDraw(
                card,
                undefined,
                event.clientX,
                event.clientY,
                mode === "click" ? "mousedown" : "mouseup",
                fromBlock,
              );
            }}
            promotedKey={promotedKey}
            highlightedRowIds={highlightedRowIds}
            onFocusCard={onFocusCard}
            onExtractRow={onExtractRow}
            onWrapSelected={onWrapSelected}
            presentReveal={presentReveal}
          />
        );
      })}
    </>
  );
}
