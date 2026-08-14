import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import type { CanvasOrigin, WhiteboardCard } from "./data";
import { useCanvasFocusApi, type CanvasFocusApi } from "./cardFocus";
import { boardMenu, canOpenBoardMenu } from "./canvasBoardMenu";
import { CanvasCards } from "./CanvasCards";
import { EdgeDropMenu } from "./EdgeDropMenu";
import { EdgeLayer, type EdgeLayerApi } from "./EdgeLayer";
import type { CardBox } from "./edgeGeometry";
import { useReferenceEdges } from "./edgeRefs";
import type { WhiteboardEdge } from "./edges";
import { useWhiteboardSettings } from "./settings";
import { useBoardDrop } from "./useBoardDrop";
import { useCanvasBoard } from "./useCanvasBoard";
import { useCanvasPointer, type CardPatchEntry } from "./useCanvasPointer";
import { useCanvasView } from "./useCanvasView";
import { type CanvasView } from "./viewTransform";

export type { CanvasView, CardPatchEntry };

const { useCallback, useRef } = window.React;

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
  onCommitEdges: (
    next: WhiteboardEdge[],
    cardIds?: ReadonlySet<DbId>,
  ) => Promise<boolean>;
  onUndo: () => void;
  onRedo: () => void;
  edges: WhiteboardEdge[];
  onViewportWidth: (width: number) => void;
  weekdayGuide?: CanvasOrigin | null;
  focusApiRef: { current: CanvasFocusApi | null };
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
  onUndo,
  onRedo,
  edges,
  onViewportWidth,
  weekdayGuide,
  focusApiRef,
}: Props) {
  const editingRef = useRef<DbId | null>(null);
  const selectedRef = useRef<DbId[]>([]);
  const selectedEdgeRef = useRef<string | null>(null);
  const cardsRef = useRef(cards);
  const edgesRef = useRef(edges);
  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const guidesRef = useRef<HTMLDivElement | null>(null);
  const edgeApiRef = useRef<EdgeLayerApi | null>(null);
  const bodyRef = useRef(document.body);
  const settings = useWhiteboardSettings();
  const settingsRef = useRef(settings);
  cardsRef.current = cards;
  edgesRef.current = edges;
  settingsRef.current = settings;
  const refEdges = useReferenceEdges(cards, edges, settings.showReferenceEdges);

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

  const {
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
    shownCards,
    degraded,
    selectedSet,
  } = useCanvasBoard({
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
  });

  const { dropActive, onDragOver, onDragLeave, onDrop } = useBoardDrop({
    boardBlockId,
    cardsRef,
    edgesRef,
    pointerToWorld,
    onAddCards,
    onCommitEdges,
  });

  useCanvasFocusApi(focusApiRef, {
    cardsRef,
    liveViewRef,
    canvasRef,
    gridRef,
    viewportRef,
    viewportSize,
    onViewChange,
    selectCards,
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

  return (
    <orca.components.ContextMenu
      container={bodyRef}
      allowBeyondContainer
      menu={(close: () => void) =>
        boardMenu(close, {
          selected,
          cards,
          cardsRef,
          selectCards,
          applyArrange,
        })
      }
    >
      {(open) => (
        <div
          ref={viewportRef}
          className={dropActive ? "owb-viewport is-drop-target" : "owb-viewport"}
          data-mouse-scheme={settings.mouseScheme}
          tabIndex={0}
          onMouseDown={onViewportMouseDown}
          onDoubleClick={(event: React.MouseEvent<HTMLDivElement>) => {
            const target = event.target as HTMLElement | null;
            if (
              target?.closest(
                ".owb-card, .owb-edge-hit, .owb-edge-editor, .owb-edge-label, .owb-edge-link-badge",
              )
            ) {
              return;
            }
            if (spaceHeldRef.current) return;
            if (event.button !== 0) return;
            event.preventDefault();
            if (edgeDrop != null) closeEdgeDrop();
            void createBlankAt(
              pointerToWorld(event.clientX, event.clientY),
              true,
            );
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onContextMenu={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest(".owb-card, .owb-edge-hit, .owb-edge-editor")) return;
            if (!canOpenBoardMenu(selectedRef, cardsRef)) {
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
              onDropEmpty={setEdgeDrop}
            />
            <CanvasCards
              panelId={panelId}
              cards={cards}
              shownCards={shownCards}
              weekdayGuide={weekdayGuide}
              degraded={degraded}
              editingId={editingId}
              selected={selected}
              selectedSet={selectedSet}
              pointerToWorld={pointerToWorld}
              selectCards={selectCards}
              selectEdge={selectEdge}
              startEdit={startEdit}
              endEdit={endEdit}
              onCardMouseDown={onCardMouseDown}
              onPatchCards={onPatchCards}
              applyArrange={applyArrange}
              onMoveFrame={onMoveFrame}
              edgeApiRef={edgeApiRef}
              onExtractRow={extractRow}
            />
          </div>
          <div ref={guidesRef} className="owb-guides" />
          <div ref={marqueeRef} className="owb-marquee" hidden />
          <EdgeDropMenu
            drop={edgeDrop}
            cards={cards}
            boardBlockId={boardBlockId}
            edges={edges}
            onAddCards={onAddCards}
            onCommitEdges={onCommitEdges}
            onClose={closeEdgeDrop}
          />
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
