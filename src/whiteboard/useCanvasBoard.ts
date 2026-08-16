import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import type { WhiteboardArea } from "./areas";
import { planColorPatches, planUnifySizePatches, type UnifySizeMode } from "./cardBatch";
import type { CanvasFocusApi } from "./cardFocus";
import { GRID_GAP, type WhiteboardCard } from "./data";
import type { DrawDropEmpty } from "./edgeGestures";
import type { EdgeLayerApi } from "./EdgeLayer";
import type { WhiteboardEdge } from "./edges";
import { extractBlocksToBoard } from "./cardExtractApply";
import { addBlankCardToBoard } from "./newCard";
import { applyCardBox, cardHasLiveGesture } from "./cardGestures";
import {
  applyFitPatches,
  planContentHeightPatches,
} from "./cardFitHeight";
import {
  arrangeCards,
  type ArrangeAction,
} from "./selection";
import { useCanvasAreas } from "./useCanvasAreas";
import { useCanvasKeys } from "./useCanvasKeys";
import type { PatchCardsFn } from "./useCanvasPointer";
import {
  isLodSimplified,
  planShownCards,
  type CanvasView,
} from "./viewTransform";
import {
  blurCardEditor,
  cardEditorFlushDelayMs,
} from "./cardEditorFlush";
import { isWhiteboardBlock } from "./pageBoardPlan";
import {
  collectSelectedIntoBoard,
  registerCollectSelectedAction,
} from "./collectIntoBoardApply";
import { dropCardsOntoBoard } from "./dropOntoBoardApply";

const { useCallback, useEffect, useMemo, useRef, useState } = window.React;

type Args = {
  panelId: string;
  boardBlockId: DbId;
  cards: WhiteboardCard[];
  edges: WhiteboardEdge[];
  areas: WhiteboardArea[];
  view: CanvasView;
  viewportSize: { width: number; height: number };
  viewportRef: { current: HTMLElement | null };
  editingRef: { current: DbId | null };
  selectedRef: { current: DbId[] };
  selectedEdgeRef: { current: string | null };
  selectedAreaRef: { current: string | null };
  cardsRef: { current: WhiteboardCard[] };
  edgesRef: { current: WhiteboardEdge[] };
  areasRef: { current: WhiteboardArea[] };
  edgeApiRef: { current: EdgeLayerApi | null };
  onPatchCards: PatchCardsFn;
  onRemoveCards: (ids: DbId[]) => Promise<boolean>;
  onAddCards: (cards: WhiteboardCard[]) => Promise<boolean>;
  onCommitEdges: (
    next: WhiteboardEdge[],
    cardIds?: ReadonlySet<DbId>,
  ) => Promise<boolean>;
  onCommitAreas: (next: WhiteboardArea[]) => Promise<boolean>;
  onCommitCardsAndAreas: (
    cards: WhiteboardCard[],
    areas: WhiteboardArea[],
  ) => Promise<boolean>;
  onExitDrawArea: () => void;
  onUndo: () => void;
  onRedo: () => void;
  liveViewRef: { current: CanvasView };
  focusApiRef: { current: CanvasFocusApi | null };
  onViewChange: (view: CanvasView) => void;
  searchOpen: boolean;
  /** Extra ids that must drop out of selection (tag filter). */
  inoperableIds?: ReadonlySet<DbId> | null;
};

export function useCanvasBoard({
  panelId,
  boardBlockId,
  cards,
  edges,
  areas,
  view,
  viewportSize,
  viewportRef,
  editingRef,
  selectedRef,
  selectedEdgeRef,
  selectedAreaRef,
  cardsRef,
  edgesRef,
  areasRef,
  edgeApiRef,
  onPatchCards,
  onRemoveCards,
  onAddCards,
  onCommitEdges,
  onCommitAreas,
  onCommitCardsAndAreas,
  onExitDrawArea,
  onUndo,
  onRedo,
  liveViewRef,
  focusApiRef,
  onViewChange,
  searchOpen,
  inoperableIds,
}: Args) {
  const [editingId, setEditingId] = useState<DbId | null>(null);
  const [selected, setSelected] = useState<DbId[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [edgeDrop, setEdgeDrop] = useState<DrawDropEmpty | null>(null);
  editingRef.current = editingId;
  selectedRef.current = selected;
  selectedEdgeRef.current = selectedEdge;

  const clearForArea = useCallback(() => {
    setSelected([]);
    setSelectedEdge(null);
  }, []);

  const {
    selectedArea,
    selectArea,
    wrapSelected,
    createAreaAt,
    renameArea,
    resizeArea,
    moveAreaBy,
    deleteSelectedArea,
  } = useCanvasAreas({
    panelId,
    boardBlockId,
    areas,
    selectedAreaRef,
    selectedRef,
    cardsRef,
    edgesRef,
    areasRef,
    onClearOtherSelection: clearForArea,
    onCommitAreas,
    onCommitCardsAndAreas,
  });

  const selectCards = useCallback((ids: DbId[]) => {
    setSelected(ids);
    setSelectedEdge(null);
    selectArea(null);
  }, [selectArea]);

  const selectEdge = useCallback((id: string | null) => {
    setSelectedEdge(id);
    if (id != null) {
      setSelected([]);
      selectArea(null);
    }
  }, [selectArea]);

  useEffect(() => {
    const ids = new Set(cards.map((card: WhiteboardCard) => card.blockId));
    if (inoperableIds != null) {
      for (const id of inoperableIds) ids.delete(id);
    }
    setSelected((prev: DbId[]) => {
      const next = prev.filter((id) => ids.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [cards, inoperableIds]);

  useEffect(() => {
    if (selectedEdge == null) return;
    if (!edges.some((edge: WhiteboardEdge) => edge.id === selectedEdge)) {
      setSelectedEdge(null);
    }
  }, [edges, selectedEdge]);

  const lodSimplified = isLodSimplified(view.scale);
  const shownPlan = useMemo(
    () => planShownCards(cards, view, viewportSize, { editingId }),
    [cards, editingId, view, viewportSize],
  );
  const shownCards = shownPlan.cards;
  const hiddenCardCount = shownPlan.hiddenCount;
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const applyContentHeight = useCallback(
    (blockId: DbId, nextH: number, record: boolean) => {
      const patches = planContentHeightPatches(
        cardsRef.current,
        blockId,
        nextH,
        GRID_GAP,
      );
      if (patches.length === 0) return;
      cardsRef.current = applyFitPatches(cardsRef.current, patches);
      const root = viewportRef.current;
      if (root != null) {
        const patched = new Set(patches.map((item) => item.blockId));
        const boxes = new Map<
          DbId,
          { x: number; y: number; w: number; h: number }
        >();
        for (const card of cardsRef.current) {
          boxes.set(card.blockId, {
            x: card.x,
            y: card.y,
            w: card.w,
            h: card.h,
          });
          if (!patched.has(card.blockId)) continue;
          const el = root.querySelector(
            `.owb-card[data-block-id="${card.blockId}"]`,
          );
          if (el instanceof HTMLElement && !cardHasLiveGesture(el)) {
            applyCardBox(el, card);
          }
        }
        edgeApiRef.current?.onFrame(boxes);
      }
      onPatchCards(patches, { record });
    },
    [onPatchCards],
  );

  const applyArrange = useCallback(
    (action: ArrangeAction, over?: readonly DbId[]) => {
      const ids = new Set<DbId>(over ?? selectedRef.current);
      const patches = arrangeCards(action, cardsRef.current, ids, viewportSize.width);
      if (patches.length === 0) return;
      onPatchCards(
        patches.map((item) => ({
          blockId: item.blockId,
          patch: { x: item.x, y: item.y },
        })),
      );
    },
    [onPatchCards, viewportSize.width],
  );

  const applyCardColor = useCallback(
    (color: string | undefined, over?: readonly DbId[]) => {
      const ids = new Set<DbId>(over ?? selectedRef.current);
      const patches = planColorPatches(cardsRef.current, ids, color);
      if (patches.length === 0) return;
      onPatchCards(patches);
    },
    [onPatchCards],
  );

  const applyUnifySize = useCallback(
    (mode: UnifySizeMode, over?: readonly DbId[]) => {
      const ids = new Set<DbId>(over ?? selectedRef.current);
      const patches = planUnifySizePatches(cardsRef.current, ids, mode);
      if (patches.length === 0) return;
      onPatchCards(patches);
    },
    [onPatchCards],
  );

  const editGenRef = useRef(0);
  const flushTimerRef = useRef(0);
  const hostUndoOnceRef = useRef(false);

  useEffect(() => {
    return () => window.clearTimeout(flushTimerRef.current);
  }, []);

  const afterEditorFlush = useCallback((fn: () => void) => {
    window.clearTimeout(flushTimerRef.current);
    blurCardEditor(viewportRef.current);
    const gen = ++editGenRef.current;
    const wait = cardEditorFlushDelayMs();
    const run = () => {
      if (gen !== editGenRef.current) return;
      fn();
    };
    if (wait <= 0) {
      run();
      return;
    }
    flushTimerRef.current = window.setTimeout(run, wait);
  }, []);

  const startEdit = useCallback((blockId: DbId) => {
    if (isWhiteboardBlock(orca.state.blocks[blockId])) return;
    edgeApiRef.current?.hideToolbar();
    const apply = () => {
      setEditingId(blockId);
      setSelectedEdge(null);
      selectArea(null);
      setSelected((prev: DbId[]) => (prev.includes(blockId) ? prev : [blockId]));
    };
    if (editingRef.current != null && editingRef.current !== blockId) {
      afterEditorFlush(apply);
      return;
    }
    editGenRef.current += 1;
    window.clearTimeout(flushTimerRef.current);
    apply();
  }, [afterEditorFlush, selectArea]);

  const endEdit = useCallback(() => {
    if (editingRef.current == null) return;
    hostUndoOnceRef.current = true;
    afterEditorFlush(() => setEditingId(null));
  }, [afterEditorFlush]);

  const closeEdgeDrop = useCallback(() => {
    setEdgeDrop(null);
    edgeApiRef.current?.clearGhost();
  }, []);

  const createBlankAt = useCallback(
    async (at: { x: number; y: number }, edit: boolean) => {
      try {
        const card = await addBlankCardToBoard({
          boardBlockId,
          x: at.x,
          y: at.y,
          addCards: onAddCards,
        });
        if (card == null) return;
        selectCards([card.blockId]);
        if (edit) startEdit(card.blockId);
      } catch (error) {
        console.error("[whiteboard] create blank card failed", error);
        orca.notify(
          "error",
          error instanceof Error
            ? error.message
            : t("Failed to create a new card"),
        );
      }
    },
    [boardBlockId, onAddCards, selectCards, startEdit],
  );

  const extractRow = useCallback(
    (blockId: DbId, sourceCard: WhiteboardCard) => {
      void extractBlocksToBoard({
        ids: [blockId],
        sourceCardId: sourceCard.blockId,
        existing: cardsRef.current,
        existingEdges: edgesRef.current,
        boardBlockId,
        addCards: onAddCards,
        commitEdges: onCommitEdges,
      })
        .then((incoming) => {
          if (incoming.length > 0) {
            selectCards(incoming.map((card) => card.blockId));
          }
        })
        .catch((error: unknown) => {
          console.error("[whiteboard] extract card failed", error);
          orca.notify(
            "error",
            error instanceof Error
              ? error.message
              : t("Failed to add blocks to the board"),
          );
        });
    },
    [boardBlockId, onAddCards, onCommitEdges, selectCards],
  );

  const collectSelected = useCallback(() => {
    void collectSelectedIntoBoard({
      boardBlockId,
      selectedIds: selectedRef.current,
      cards: cardsRef.current,
      edges: edgesRef.current,
      areas: areasRef.current,
      selectCards,
    });
  }, [boardBlockId, selectCards]);

  const dropOntoBoard = useCallback(
    (targetBoardId: DbId, movingIds: readonly DbId[]) =>
      dropCardsOntoBoard({
        boardBlockId,
        targetBoardId,
        movingIds,
        cards: cardsRef.current,
        edges: edgesRef.current,
        areas: areasRef.current,
        selectCards,
      }),
    [boardBlockId, selectCards],
  );

  useEffect(
    () => registerCollectSelectedAction(panelId, collectSelected),
    [panelId, collectSelected],
  );

  useCanvasKeys({
    panelId,
    boardBlockId,
    searchOpen,
    viewportRef,
    editingRef,
    selectedRef,
    selectedEdgeRef,
    cardsRef,
    edgesRef,
    liveViewRef,
    viewportSize,
    focusApiRef,
    hostUndoOnceRef,
    onPatchCards,
    onRemoveCards,
    onCommitEdges,
    onUndo,
    onRedo,
    onExitDrawArea,
    selectCards,
    selectArea,
    deleteSelectedArea,
    setSelectedEdge,
    endEdit,
    onViewChange,
  });

  return {
    editingId,
    selected,
    selectedEdge,
    selectedArea,
    edgeDrop,
    setEdgeDrop,
    selectCards,
    selectEdge,
    selectArea,
    wrapSelected,
    createAreaAt,
    renameArea,
    resizeArea,
    moveAreaBy,
    applyArrange,
    applyCardColor,
    applyUnifySize,
    applyContentHeight,
    startEdit,
    endEdit,
    closeEdgeDrop,
    createBlankAt,
    extractRow,
    dropOntoBoard,
    shownCards,
    hiddenCardCount,
    lodSimplified,
    selectedSet,
  };
}
