import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  handleWhiteboardKey,
  isWhiteboardShortcutTarget,
} from "./canvasKeys";
import { type WhiteboardCard } from "./data";
import type { DrawDropEmpty } from "./edgeGestures";
import type { EdgeLayerApi } from "./EdgeLayer";
import type { WhiteboardEdge } from "./edges";
import { extractBlocksToBoard } from "./cardExtractApply";
import { readExtractRestore } from "./cardExtractModel";
import { addBlankCardToBoard } from "./newCard";
import {
  arrangeCards,
  type ArrangeAction,
} from "./selection";
import type { CardPatchEntry } from "./useCanvasPointer";
import {
  CARD_LOD_SCALE,
  visibleCards,
  type CanvasView,
} from "./viewTransform";

const { useCallback, useEffect, useMemo, useState } = window.React;

type Args = {
  panelId: string;
  boardBlockId: DbId;
  cards: WhiteboardCard[];
  edges: WhiteboardEdge[];
  view: CanvasView;
  viewportSize: { width: number; height: number };
  viewportRef: { current: HTMLElement | null };
  editingRef: { current: DbId | null };
  selectedRef: { current: DbId[] };
  selectedEdgeRef: { current: string | null };
  cardsRef: { current: WhiteboardCard[] };
  edgesRef: { current: WhiteboardEdge[] };
  edgeApiRef: { current: EdgeLayerApi | null };
  onPatchCards: (entries: CardPatchEntry[]) => void;
  onRemoveCards: (ids: DbId[]) => Promise<boolean>;
  onAddCards: (cards: WhiteboardCard[]) => Promise<boolean>;
  onCommitEdges: (
    next: WhiteboardEdge[],
    cardIds?: ReadonlySet<DbId>,
  ) => Promise<boolean>;
  onUndo: () => void;
  onRedo: () => void;
  onRestoreExtract: (cardBlockId: DbId) => Promise<boolean>;
};

export function useCanvasBoard({
  panelId,
  boardBlockId,
  cards,
  edges,
  view,
  viewportSize,
  viewportRef,
  editingRef,
  selectedRef,
  selectedEdgeRef,
  cardsRef,
  edgesRef,
  edgeApiRef,
  onPatchCards,
  onRemoveCards,
  onAddCards,
  onCommitEdges,
  onUndo,
  onRedo,
  onRestoreExtract,
}: Args) {
  const [editingId, setEditingId] = useState<DbId | null>(null);
  const [selected, setSelected] = useState<DbId[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [edgeDrop, setEdgeDrop] = useState<DrawDropEmpty | null>(null);
  editingRef.current = editingId;
  selectedRef.current = selected;
  selectedEdgeRef.current = selectedEdge;

  const selectCards = useCallback((ids: DbId[]) => {
    setSelected(ids);
    setSelectedEdge(null);
  }, []);

  const selectEdge = useCallback((id: string | null) => {
    setSelectedEdge(id);
    if (id != null) setSelected([]);
  }, []);

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

  const pinned = useMemo(() => {
    const ids = new Set(selected);
    if (editingId != null) ids.add(editingId);
    return ids;
  }, [editingId, selected]);

  const shownCards = useMemo(
    () => visibleCards(cards, view, viewportSize, pinned),
    [cards, pinned, view, viewportSize],
  );
  const degraded = view.scale < CARD_LOD_SCALE;
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const applyArrange = useCallback(
    (action: ArrangeAction) => {
      const ids = new Set<DbId>(selectedRef.current);
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
    setSelected((prev: DbId[]) => (prev.includes(blockId) ? prev : [blockId]));
  }, []);

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

  const restoreExtracted = useCallback(
    (card: WhiteboardCard) => {
      const info = readExtractRestore(orca.state.blocks[card.blockId]);
      const sourceId = info?.sourceCardId ?? null;
      void onRestoreExtract(card.blockId)
        .then((ok) => {
          if (!ok) return;
          if (editingRef.current === card.blockId) setEditingId(null);
          if (
            sourceId != null &&
            cardsRef.current.some(
              (item: WhiteboardCard) => item.blockId === sourceId,
            )
          ) {
            selectCards([sourceId]);
            return;
          }
          selectCards([]);
        })
        .catch((error: unknown) => {
          console.error("[whiteboard] restore extract failed", error);
          orca.notify(
            "error",
            error instanceof Error
              ? error.message
              : t("Failed to move this card back to the source card"),
          );
        });
    },
    [onRestoreExtract, selectCards],
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
        escape: () => selectCards([]),
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
    onCommitEdges,
    onPatchCards,
    onRedo,
    onRemoveCards,
    onUndo,
    panelId,
    selectCards,
    viewportRef,
  ]);

  return {
    editingId,
    selected,
    selectedEdge,
    edgeDrop,
    setEdgeDrop,
    selectCards,
    selectEdge,
    applyArrange,
    startEdit,
    endEdit,
    closeEdgeDrop,
    createBlankAt,
    extractRow,
    restoreExtracted,
    shownCards,
    degraded,
    selectedSet,
  };
}
