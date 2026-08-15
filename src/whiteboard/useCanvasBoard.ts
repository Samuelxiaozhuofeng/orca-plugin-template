import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  nextAreaId,
  planAreaFromCards,
  removeArea,
  type WhiteboardArea,
} from "./areas";
import { runAsHistoryStep } from "./boardHistory";
import {
  handleWhiteboardKey,
  isWhiteboardShortcutTarget,
} from "./canvasKeys";
import { GRID_GAP, type WhiteboardCard } from "./data";
import { CARD_MOUNT_CAP } from "./layout";
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
import type { CardPatchEntry, PatchCardsFn } from "./useCanvasPointer";
import {
  isLodSimplified,
  pickMountedCards,
  visibleCards,
  type CanvasView,
} from "./viewTransform";

const { useCallback, useEffect, useMemo, useState } = window.React;

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
  onExitDrawArea: () => void;
  onUndo: () => void;
  onRedo: () => void;
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
  onExitDrawArea,
  onUndo,
  onRedo,
}: Args) {
  const [editingId, setEditingId] = useState<DbId | null>(null);
  const [selected, setSelected] = useState<DbId[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [edgeDrop, setEdgeDrop] = useState<DrawDropEmpty | null>(null);
  editingRef.current = editingId;
  selectedRef.current = selected;
  selectedEdgeRef.current = selectedEdge;
  selectedAreaRef.current = selectedArea;

  const selectCards = useCallback((ids: DbId[]) => {
    setSelected(ids);
    setSelectedEdge(null);
    setSelectedArea(null);
  }, []);

  const selectEdge = useCallback((id: string | null) => {
    setSelectedEdge(id);
    if (id != null) {
      setSelected([]);
      setSelectedArea(null);
    }
  }, []);

  const selectArea = useCallback((id: string | null) => {
    setSelectedArea(id);
    if (id != null) {
      setSelected([]);
      setSelectedEdge(null);
    }
  }, []);

  const snapshotNow = useCallback(() => {
    return {
      cards: cardsRef.current.map((card: WhiteboardCard) => ({ ...card })),
      edges: edgesRef.current.map((edge: WhiteboardEdge) => ({ ...edge })),
      areas: areasRef.current.map((area: WhiteboardArea) => ({ ...area })),
    };
  }, []);

  const commitAreasStep = useCallback(
    async (next: WhiteboardArea[]): Promise<boolean> => {
      return runAsHistoryStep(boardBlockId, snapshotNow(), () =>
        onCommitAreas(next),
      );
    },
    [boardBlockId, onCommitAreas, snapshotNow],
  );

  useEffect(() => {
    const ids = new Set(cards.map((card: WhiteboardCard) => card.blockId));
    setSelected((prev: DbId[]) => {
      const next = prev.filter((id) => ids.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [cards]);

  useEffect(() => {
    if (selectedEdge == null) return;
    if (!edges.some((edge: WhiteboardEdge) => edge.id === selectedEdge)) {
      setSelectedEdge(null);
    }
  }, [edges, selectedEdge]);

  useEffect(() => {
    if (selectedArea == null) return;
    if (!areas.some((area: WhiteboardArea) => area.id === selectedArea)) {
      setSelectedArea(null);
    }
  }, [areas, selectedArea]);

  const pinned = useMemo(() => {
    const ids = new Set(selected);
    if (editingId != null) ids.add(editingId);
    return ids;
  }, [editingId, selected]);

  const lodSimplified = isLodSimplified(view.scale);
  const shownPlan = useMemo(() => {
    const visible = visibleCards(cards, view, viewportSize, pinned);
    return pickMountedCards(visible, {
      cap: CARD_MOUNT_CAP,
      editingId,
      selectedIds: selected,
      view,
      viewport: viewportSize,
    });
  }, [cards, editingId, pinned, selected, view, viewportSize]);
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

  const startEdit = useCallback((blockId: DbId) => {
    setEditingId(blockId);
    setSelectedEdge(null);
    setSelectedArea(null);
    setSelected((prev: DbId[]) => (prev.includes(blockId) ? prev : [blockId]));
  }, []);

  const wrapSelected = useCallback(() => {
    const ids = new Set<DbId>(selectedRef.current);
    const picked = cardsRef.current.filter((card: WhiteboardCard) =>
      ids.has(card.blockId),
    );
    const box = planAreaFromCards(picked);
    if (box == null) return;
    const current = areasRef.current;
    const area: WhiteboardArea = {
      id: nextAreaId(current),
      name: t("Section"),
      ...box,
    };
    void commitAreasStep([...current, area]).then((ok: boolean) => {
      if (ok) selectArea(area.id);
    });
  }, [commitAreasStep, selectArea]);

  const createAreaAt = useCallback(
    (box: { x: number; y: number; w: number; h: number }) => {
      const current = areasRef.current;
      const area: WhiteboardArea = {
        id: nextAreaId(current),
        name: t("Section"),
        ...box,
      };
      void commitAreasStep([...current, area]).then((ok: boolean) => {
        if (ok) selectArea(area.id);
      });
    },
    [commitAreasStep, selectArea],
  );

  const renameArea = useCallback(
    (id: string, raw: string) => {
      const name = raw.trim() || t("Section");
      const current = areasRef.current;
      const target = current.find((area: WhiteboardArea) => area.id === id);
      if (target == null || target.name === name) return;
      void commitAreasStep(
        current.map((area: WhiteboardArea) =>
          area.id === id ? { ...area, name } : area,
        ),
      );
    },
    [commitAreasStep],
  );

  const resizeArea = useCallback(
    (id: string, box: { x: number; y: number; w: number; h: number }) => {
      const current = areasRef.current;
      const target = current.find((area: WhiteboardArea) => area.id === id);
      if (target == null) return;
      if (
        target.x === box.x &&
        target.y === box.y &&
        target.w === box.w &&
        target.h === box.h
      ) {
        return;
      }
      void commitAreasStep(
        current.map((area: WhiteboardArea) =>
          area.id === id ? { ...area, ...box } : area,
        ),
      );
    },
    [commitAreasStep],
  );

  const endEdit = useCallback(() => setEditingId(null), []);

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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && editingRef.current != null) {
        setEditingId(null);
        return;
      }
      if (
        !isWhiteboardShortcutTarget(event, {
          panelId,
          editing: editingRef.current != null,
          viewport: viewportRef.current,
        })
      ) {
        return;
      }
      handleWhiteboardKey(event, {
        nudge: (dx, dy) => {
          const ids = new Set<DbId>(selectedRef.current);
          if (ids.size === 0) return;
          const entries: CardPatchEntry[] = [];
          cardsRef.current = cardsRef.current.map((card: WhiteboardCard) => {
            if (!ids.has(card.blockId)) return card;
            const next = { ...card, x: card.x + dx, y: card.y + dy };
            entries.push({
              blockId: card.blockId,
              patch: { x: next.x, y: next.y },
            });
            return next;
          });
          onPatchCards(entries);
        },
        selectAll: () => {
          selectCards(cardsRef.current.map((card: WhiteboardCard) => card.blockId));
        },
        escape: () => {
          selectCards([]);
          selectArea(null);
          onExitDrawArea();
        },
        remove: () => {
          const edgeId = selectedEdgeRef.current;
          if (edgeId != null) {
            void onCommitEdges(
              edgesRef.current.filter((edge: WhiteboardEdge) => edge.id !== edgeId),
            ).then((ok) => {
              if (ok) setSelectedEdge(null);
            });
            return;
          }
          const areaId = selectedAreaRef.current;
          if (areaId != null) {
            void commitAreasStep(removeArea(areasRef.current, areaId)).then(
              (ok: boolean) => {
                if (ok) selectArea(null);
              },
            );
            return;
          }
          const ids = selectedRef.current;
          if (ids.length === 0) return;
          void onRemoveCards(ids).then((ok) => {
            if (ok) selectCards([]);
          });
        },
        undo: onUndo,
        redo: onRedo,
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    commitAreasStep,
    onCommitEdges,
    onExitDrawArea,
    onPatchCards,
    onRedo,
    onRemoveCards,
    onUndo,
    panelId,
    selectArea,
    selectCards,
    viewportRef,
  ]);

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
    applyArrange,
    applyContentHeight,
    startEdit,
    endEdit,
    closeEdgeDrop,
    createBlankAt,
    extractRow,
    shownCards,
    hiddenCardCount,
    lodSimplified,
    selectedSet,
  };
}
