import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { ArrangeMenuItems } from "./ArrangeMenu";
import {
  handleWhiteboardKey,
  isWhiteboardShortcutTarget,
} from "./canvasKeys";
import {
  WEEKDAY_LABELS_MON,
  type CanvasOrigin,
  type WhiteboardCard,
} from "./data";
import { Card } from "./Card";
import { EdgeLayer, type EdgeLayerApi } from "./EdgeLayer";
import type { CardBox } from "./edgeGeometry";
import { useReferenceEdges } from "./edgeRefs";
import type { Side, WhiteboardEdge } from "./edges";
import {
  arrangeCards,
  type ArrangeAction,
} from "./selection";
import { useWhiteboardSettings } from "./settings";
import { useBoardDrop } from "./useBoardDrop";
import {
  useCanvasPointer,
  type CardPatchEntry,
} from "./useCanvasPointer";
import { useCanvasView } from "./useCanvasView";
import {
  CARD_LOD_SCALE,
  visibleCards,
  type CanvasView,
} from "./viewTransform";

export type { CanvasView, CardPatchEntry };

const { useCallback, useEffect, useMemo, useRef, useState } = window.React;

type Props = {
  panelId: string;
  boardBlockId: DbId;
  cards: WhiteboardCard[];
  view: CanvasView;
  zoomLabelRef: { current: HTMLElement | null };
  onViewChange: (view: CanvasView) => void;
  onPatchCards: (entries: CardPatchEntry[]) => void;
  onRemoveCards: (ids: DbId[]) => Promise<boolean>;
  onAddCards: (cards: WhiteboardCard[]) => Promise<boolean>;
  onCommitEdges: (next: WhiteboardEdge[]) => Promise<boolean>;
  edges: WhiteboardEdge[];
  onViewportWidth: (width: number) => void;
  weekdayGuide?: CanvasOrigin | null;
};

export function Canvas({
  panelId,
  boardBlockId,
  cards,
  view,
  zoomLabelRef,
  onViewChange,
  onPatchCards,
  onRemoveCards,
  onAddCards,
  onCommitEdges,
  edges,
  onViewportWidth,
  weekdayGuide,
}: Props) {
  const [editingId, setEditingId] = useState<DbId | null>(null);
  const [selected, setSelected] = useState<DbId[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const editingRef = useRef<DbId | null>(null);
  const selectedRef = useRef<DbId[]>([]);
  const selectedEdgeRef = useRef<string | null>(null);
  const cardsRef = useRef(cards);
  const edgesRef = useRef(edges);
  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const guidesRef = useRef<HTMLDivElement | null>(null);
  const edgeApiRef = useRef<EdgeLayerApi | null>(null);
  const settings = useWhiteboardSettings();
  const settingsRef = useRef(settings);
  editingRef.current = editingId;
  selectedRef.current = selected;
  selectedEdgeRef.current = selectedEdge;
  cardsRef.current = cards;
  edgesRef.current = edges;
  settingsRef.current = settings;
  const refEdges = useReferenceEdges(cards, edges, settings.showReferenceEdges);

  const selectCards = useCallback((ids: DbId[]) => {
    setSelected(ids);
    setSelectedEdge(null);
  }, []);

  const selectEdge = useCallback((id: string | null) => {
    setSelectedEdge(id);
    if (id != null) setSelected([]);
  }, []);

  const onMoveFrame = useCallback((boxes: Map<DbId, CardBox>) => {
    edgeApiRef.current?.onFrame(boxes);
  }, []);

  const {
    viewportRef,
    canvasRef,
    gridRef,
    liveViewRef,
    viewportSize,
    spaceHeldRef,
    pointerToWorld,
    startPan,
  } = useCanvasView({
    panelId,
    view,
    zoomLabelRef,
    onViewChange,
    onViewportWidth,
    isEditing: () => editingRef.current != null,
  });

  const { dropActive, onDragOver, onDragLeave, onDrop } = useBoardDrop({
    boardBlockId,
    cardsRef,
    pointerToWorld,
    onAddCards,
  });

  const { onViewportMouseDown, onCardMouseDown } = useCanvasPointer({
    refs: {
      viewport: viewportRef,
      canvas: canvasRef,
      marquee: marqueeRef,
      guides: guidesRef,
      spaceHeld: spaceHeldRef,
      settings: settingsRef,
      editing: editingRef,
      selected: selectedRef,
      cards: cardsRef,
      liveView: liveViewRef,
    },
    pointerToWorld,
    startPan,
    setSelected: selectCards,
    onPatchCards,
    onMoveFrame,
  });

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
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCommitEdges, onPatchCards, onRemoveCards, panelId, selectCards, viewportRef]);

  const canOpenBoardMenu = () => {
    if (selectedRef.current.length >= 2) return true;
    return (
      selectedRef.current.length === 0 && cardsRef.current.length > 0
    );
  };

  const boardMenu = (close: () => void) => (
    <orca.components.Menu>
      {selected.length === 0 && cards.length > 0 ? (
        <orca.components.MenuText
          title={t("Select all")}
          onClick={() => {
            close();
            selectCards(cardsRef.current.map((card: WhiteboardCard) => card.blockId));
          }}
        />
      ) : null}
      <ArrangeMenuItems
        close={close}
        selectedCount={selected.length}
        onArrange={applyArrange}
        leadingSeparator={false}
      />
    </orca.components.Menu>
  );

  return (
    <orca.components.ContextMenu menu={boardMenu}>
      {(open) => (
        <div
          ref={viewportRef}
          className={dropActive ? "owb-viewport is-drop-target" : "owb-viewport"}
          data-mouse-scheme={settings.mouseScheme}
          tabIndex={0}
          onMouseDown={onViewportMouseDown}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onContextMenu={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest(".owb-card, .owb-edge-hit, .owb-edge-editor")) return;
            if (!canOpenBoardMenu()) {
              event.preventDefault();
              return;
            }
            open(event);
          }}
        >
          <div ref={gridRef} className="owb-grid" />
          <div ref={canvasRef} className="owb-canvas">
            <EdgeLayer
              panelId={panelId}
              cards={cards}
              edges={edges}
              refEdges={refEdges}
              viewScale={view.scale}
              selectedId={selectedEdge}
              canvasRef={canvasRef}
              pointerToWorld={pointerToWorld}
              focusViewport={() =>
                viewportRef.current?.focus({ preventScroll: true })
              }
              apiRef={edgeApiRef}
              onSelect={selectEdge}
              onCommit={onCommitEdges}
            />
            {weekdayGuide != null ? (
              <div
                className="owb-cal-weekdays"
                style={{ left: weekdayGuide.x, top: weekdayGuide.y }}
              >
                {WEEKDAY_LABELS_MON.map((label) => (
                  <div key={label} className="owb-cal-weekday">
                    {label}
                  </div>
                ))}
              </div>
            ) : null}
            {shownCards.map((card: WhiteboardCard) => (
              <Card
                key={card.blockId}
                panelId={panelId}
                card={card}
                degraded={degraded && editingId !== card.blockId}
                editing={editingId === card.blockId}
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
                  setSelectedEdge(null);
                  onCardMouseDown(event, card);
                }}
                onPatchCard={(blockId, patch) =>
                  onPatchCards([{ blockId, patch }])
                }
                onArrange={applyArrange}
                onMoveFrame={onMoveFrame}
                onAnchorMouseDown={(
                  card: WhiteboardCard,
                  side: Side,
                  event: React.MouseEvent<HTMLDivElement>,
                ) => {
                  edgeApiRef.current?.startDraw(
                    card,
                    side,
                    event.clientX,
                    event.clientY,
                  );
                }}
              />
            ))}
          </div>
          <div ref={guidesRef} className="owb-guides" />
          <div ref={marqueeRef} className="owb-marquee" hidden />
          {cards.length === 0 && (
            <div className="owb-canvas-empty">
              <i className="ti ti-layout-grid owb-canvas-empty-icon" />
              <div className="owb-canvas-empty-title">
                {t("This board is empty")}
              </div>
              <div className="owb-canvas-empty-sub">
                {t(
                  "Use the toolbar to place journals, or drag blocks here from a note.",
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </orca.components.ContextMenu>
  );
}
