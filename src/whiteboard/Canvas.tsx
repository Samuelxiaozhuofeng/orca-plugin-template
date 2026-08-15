import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { AreaLayer } from "./AreaLayer";
import type { WhiteboardArea } from "./areas";
import type { CanvasOrigin, WhiteboardCard } from "./data";
import {
  tryFocusCardFromRefClick,
  useCanvasFocusApi,
  type CanvasFocusApi,
} from "./cardFocus";
import { AddNoteCard } from "./AddNoteCard";
import { BoardContextMenu } from "./canvasBoardMenu";
import { CanvasCards } from "./CanvasCards";
import { EdgeDropMenu } from "./EdgeDropMenu";
import { EdgeLayer, type EdgeLayerApi } from "./EdgeLayer";
import type { CardBox } from "./edgeGeometry";
import { useReferenceEdges } from "./edgeRefs";
import type { WhiteboardEdge } from "./edges";
import { useWhiteboardSettings } from "./settings";
import { useBoardDrop } from "./useBoardDrop";
import { useCanvasBoard } from "./useCanvasBoard";
import {
  useCanvasPointer,
  type CardPatchEntry,
  type PatchCardsFn,
} from "./useCanvasPointer";
import { useCanvasView } from "./useCanvasView";
import { type CanvasView } from "./viewTransform";

export type { CanvasView, CardPatchEntry };

const { useCallback, useRef, useState } = window.React;

type Props = {
  panelId: string;
  boardBlockId: DbId;
  cards: WhiteboardCard[];
  view: CanvasView;
  zoomLabelRef: { current: HTMLElement | null };
  onViewChange: (view: CanvasView) => void;
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
  drawArea: boolean;
  onExitDrawArea: () => void;
  onStartDrawArea: () => void;
  onUndo: () => void;
  onRedo: () => void;
  edges: WhiteboardEdge[];
  areas: WhiteboardArea[];
  onViewportWidth: (width: number) => void;
  /** Opens the journal dialog with cards landing at this canvas point. */
  onPlaceJournalsAt: (origin: CanvasOrigin) => void;
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
  onCommitAreas,
  onCommitCardsAndAreas,
  drawArea,
  onExitDrawArea,
  onStartDrawArea,
  onUndo,
  onRedo,
  edges,
  areas,
  onViewportWidth,
  onPlaceJournalsAt,
  weekdayGuide,
  focusApiRef,
}: Props) {
  const editingRef = useRef<DbId | null>(null);
  const selectedRef = useRef<DbId[]>([]);
  const selectedEdgeRef = useRef<string | null>(null);
  const selectedAreaRef = useRef<string | null>(null);
  const cardsRef = useRef(cards);
  const edgesRef = useRef(edges);
  const areasRef = useRef(areas);
  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const areaGhostRef = useRef<HTMLDivElement | null>(null);
  const toolRef = useRef<"select" | "drawArea">("select");
  const guidesRef = useRef<HTMLDivElement | null>(null);
  const edgeApiRef = useRef<EdgeLayerApi | null>(null);
  const menuPointRef = useRef<CanvasOrigin>({ x: 0, y: 0 });
  const [boardMenuAt, setBoardMenuAt] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [addNoteAt, setAddNoteAt] = useState<CanvasOrigin | null>(null);
  const settings = useWhiteboardSettings();
  const settingsRef = useRef(settings);
  cardsRef.current = cards;
  edgesRef.current = edges;
  areasRef.current = areas;
  settingsRef.current = settings;
  toolRef.current = drawArea ? "drawArea" : "select";

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
  } = useCanvasBoard({
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
  });

  const { edges: refEdges, truncated: refEdgesTruncated } = useReferenceEdges(
    shownCards,
    edges,
    settings.showReferenceEdges,
  );

  const {
    dropActive,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnterCapture,
    onDragOverCapture,
    onDragLeaveCapture,
    onDropCapture,
  } = useBoardDrop({
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
      tool: toolRef,
      areaGhost: areaGhostRef,
      areas: areasRef,
    },
    pointerToWorld,
    startPan,
    setSelected: selectCards,
    setSelectedArea: selectArea,
    onCreateArea: createAreaAt,
    onExitDrawArea,
    onPatchCards,
    onMoveArea: moveAreaBy,
    onMoveFrame,
  });

  return (
    <>
      <div
          ref={viewportRef}
          className={[
            "owb-viewport",
            dropActive ? "is-drop-target" : "",
            drawArea ? "is-draw-area" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-mouse-scheme={settings.mouseScheme}
          tabIndex={0}
          onMouseDown={onViewportMouseDown}
          onDoubleClick={(event: React.MouseEvent<HTMLDivElement>) => {
            const target = event.target as HTMLElement | null;
            if (
              target?.closest(
                ".owb-card, .owb-edge-hit, .owb-edge-editor, .owb-edge-label, .owb-edge-link-badge, .owb-area-title, .owb-area-handle",
              )
            ) {
              return;
            }
            if (spaceHeldRef.current || drawArea) return;
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
          onDragEnterCapture={onDragEnterCapture}
          onDragOverCapture={onDragOverCapture}
          onDragLeaveCapture={onDragLeaveCapture}
          onDropCapture={onDropCapture}
          onClickCapture={(event: React.MouseEvent<HTMLDivElement>) => {
            tryFocusCardFromRefClick(
              event,
              cardsRef.current,
              (cardBlockId) =>
                focusApiRef.current?.focusCard(cardBlockId) ?? false,
            );
          }}
          onContextMenu={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest(".owb-card, .owb-edge-hit, .owb-edge-editor, .owb-area-title, .owb-area-handle")) return;
            event.preventDefault();
            event.stopPropagation();
            // Anything the menu creates lands where the user right-clicked.
            menuPointRef.current = pointerToWorld(event.clientX, event.clientY);
            setBoardMenuAt({ x: event.clientX, y: event.clientY });
          }}
        >
          <div ref={gridRef} className="owb-grid" />
          <div ref={canvasRef} className="owb-canvas">
            <AreaLayer
              areas={areas}
              selectedId={selectedArea}
              view={view}
              viewportSize={viewportSize}
              ghostRef={areaGhostRef}
              canvasRef={canvasRef}
              pointerToWorld={pointerToWorld}
              cards={cards}
              onSelect={selectArea}
              onRename={renameArea}
              onResize={resizeArea}
              onMove={moveAreaBy}
              onMoveFrame={onMoveFrame}
            />
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
              lodSimplified={lodSimplified}
              weekdayGuide={weekdayGuide}
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
              onContentHeight={applyContentHeight}
              applyArrange={applyArrange}
              onMoveFrame={onMoveFrame}
              edgeApiRef={edgeApiRef}
              onExtractRow={extractRow}
              onWrapSelected={wrapSelected}
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
          {hiddenCardCount > 0 || refEdgesTruncated ? (
            <div className="owb-lod-hint" role="status">
              {hiddenCardCount > 0 ? (
                <div>
                  {t(
                    "Showing ${shown} of ${visible} cards. Zoom in to see all.",
                    {
                      shown: String(shownCards.length),
                      visible: String(shownCards.length + hiddenCardCount),
                    },
                  )}
                </div>
              ) : null}
              {refEdgesTruncated ? (
                <div>
                  {t("Too many reference links; only some are shown.")}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      {addNoteAt != null ? (
        <AddNoteCard
          boardBlockId={boardBlockId}
          at={addNoteAt}
          cardsRef={cardsRef}
          onAddCards={onAddCards}
          onFocusCard={(cardBlockId: DbId) => {
            focusApiRef.current?.focusCard(cardBlockId);
          }}
          onClose={() => setAddNoteAt(null)}
        />
      ) : null}
      <BoardContextMenu
        at={addNoteAt == null ? boardMenuAt : null}
        onClose={() => setBoardMenuAt(null)}
        opts={{
          selected,
          cards,
          cardsRef,
          selectCards,
          applyArrange,
          onNewCard: () => void createBlankAt(menuPointRef.current, true),
          onAddFromNote: () => {
            setBoardMenuAt(null);
            setAddNoteAt(menuPointRef.current);
          },
          onPlaceJournals: () => onPlaceJournalsAt(menuPointRef.current),
          onDrawArea: onStartDrawArea,
          onFitAll: () => {
            focusApiRef.current?.fitAll();
          },
        }}
      />
    </>
  );
}
