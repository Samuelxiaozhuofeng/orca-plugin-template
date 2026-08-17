import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { AddNoteCard } from "./AddNoteCard";
import { BoardContextMenu } from "./canvasBoardMenu";
import { registerFindCardAction } from "./cardSearch";
import { CardSearchOverlay } from "./CardSearchOverlay";
import type { CanvasFocusApi } from "./cardFocus";
import type { UnifySizeMode } from "./cardBatch";
import type { CanvasOrigin, WhiteboardCard } from "./data";
import { EdgeDropMenu } from "./EdgeDropMenu";
import type { DrawDropEmpty } from "./edgeGestures";
import type { WhiteboardEdge } from "./edges";
import type { ArrangeAction } from "./selection";
import { CardFilterBanner } from "./CardFilterPopover";
import { SelectionToolbar } from "./SelectionToolbar";
import { placeNewSubBoardOnBoard } from "./collectIntoBoardApply";
import type { MediaKind } from "./insertMediaCard";
import { RelationMap } from "./RelationMap";

import type { WhiteboardArea } from "./areas";
import { areaChromeFor, areasForPanel } from "./useCanvasAreas";
import { registerSlideOutlineAction } from "./slideOutlineAction.ts";
import { SlideOutline } from "./SlideOutline.tsx";
import { slideOutlineRows } from "./slideOutline.ts";

const { useCallback, useEffect, useMemo, useRef, useState } = window.React;

/** Search / menu / add-note state, plus find-command registration for this panel. */
export function useCanvasOverlayState(panelId: string) {
  const menuPointRef = useRef<CanvasOrigin>({ x: 0, y: 0 });
  const [boardMenuAt, setBoardMenuAt] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [addNoteAt, setAddNoteAt] = useState<CanvasOrigin | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState<boolean>(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  const toggleOutline = useCallback(
    () => setOutlineOpen((open: boolean) => !open),
    [],
  );
  const closeOutline = useCallback(() => setOutlineOpen(false), []);

  useEffect(
    () => registerFindCardAction(panelId, openSearch),
    [openSearch, panelId],
  );

  useEffect(
    () => registerSlideOutlineAction(panelId, toggleOutline),
    [toggleOutline, panelId],
  );

  const openBoardMenu = useCallback(
    (client: { x: number; y: number }, world: CanvasOrigin) => {
      menuPointRef.current = world;
      setBoardMenuAt(client);
    },
    [],
  );

  return {
    panelId,
    menuPointRef,
    boardMenuAt,
    setBoardMenuAt,
    addNoteAt,
    setAddNoteAt,
    searchOpen,
    openSearch,
    closeSearch,
    outlineOpen,
    toggleOutline,
    closeOutline,
    openBoardMenu,
  };
}

type SharedProps = {
  overlay: ReturnType<typeof useCanvasOverlayState>;
  boardBlockId: DbId;
  cards: WhiteboardCard[];
  viewCards: WhiteboardCard[];
  interactiveCards: WhiteboardCard[];
  cardsRef: { current: WhiteboardCard[] };
  selected: DbId[];
  selectCards: (ids: DbId[]) => void;
  edges: WhiteboardEdge[];
  areas?: WhiteboardArea[];
  focusApiRef: { current: CanvasFocusApi | null };
  onAddCards: (cards: WhiteboardCard[]) => Promise<boolean>;
  onCommitEdges: (
    next: WhiteboardEdge[],
    cardIds?: ReadonlySet<DbId>,
  ) => Promise<boolean>;
  applyCardColor: (color: string | undefined) => void;
  applyUnifySize: (mode: UnifySizeMode) => void;
  applyArrange: (action: ArrangeAction, ids?: readonly DbId[]) => void;
  onWrapSelected: () => void;
  filterActive: boolean;
  filterTags: readonly string[];
  filterMatched: number;
  filterTotal: number;
  onClearFilter: () => void;
};

/** Status chrome and in-viewport popovers (must sit inside `.owb-viewport`). */
export function CanvasViewportOverlays({
  overlay,
  boardBlockId,
  cards,
  viewCards,
  interactiveCards,
  selected,
  selectCards,
  edges,
  areas,
  edgeDrop,
  hiddenCardCount,
  shownCount,
  refEdgesTruncated,
  focusApiRef,
  onAddCards,
  onCommitEdges,
  onCloseEdgeDrop,
  applyCardColor,
  applyUnifySize,
  applyArrange,
  onWrapSelected,
  filterActive,
  filterTags,
  filterMatched,
  filterTotal,
  onClearFilter,
}: SharedProps & {
  edgeDrop: DrawDropEmpty | null;
  hiddenCardCount: number;
  shownCount: number;
  refEdgesTruncated: boolean;
  onCloseEdgeDrop: () => void;
}) {
  const { searchOpen, closeSearch, outlineOpen, closeOutline, panelId } = overlay;
  const panelAreas = areas ?? (panelId ? areasForPanel(panelId) : []);
  const outlineRows = useMemo(
    () => slideOutlineRows(panelAreas, cards),
    [panelAreas, cards],
  );

  const handleOutlinePick = useCallback(
    (areaId: string) => {
      const chrome = areaChromeFor(panelId);
      chrome?.selectArea?.(areaId);
      const target = panelAreas.find((a) => a.id === areaId);
      if (target) {
        focusApiRef.current?.fitBoxes([
          { x: target.x, y: target.y, w: target.w, h: target.h },
        ]);
      }
    },
    [focusApiRef, panelAreas, panelId],
  );

  const handleOutlineRemove = useCallback(
    (areaId: string) => {
      areaChromeFor(panelId)?.removeFromSlides(areaId);
    },
    [panelId],
  );

  const handleOutlineReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      areaChromeFor(panelId)?.reorderSlides(fromIndex, toIndex);
    },
    [panelId],
  );

  return (
    <>
      <EdgeDropMenu
        drop={edgeDrop}
        cards={cards}
        boardBlockId={boardBlockId}
        edges={edges}
        onAddCards={onAddCards}
        onCommitEdges={onCommitEdges}
        onClose={onCloseEdgeDrop}
      />
      {cards.length === 0 ? (
        <div className="owb-canvas-empty">
          <i className="ti ti-layout-grid owb-canvas-empty-icon" />
          <div className="owb-canvas-empty-title">
            {t("This board is empty")}
          </div>
          <div className="owb-canvas-empty-sub">
            {t(
              "Right-click empty space and choose New card here. You can also place journals from the toolbar, or drag blocks here from a note.",
            )}
          </div>
          <div className="owb-canvas-empty-sub">
            {t(
              "Pan and zoom follow the mouse or trackpad mode in the plugin settings.",
            )}
          </div>
        </div>
      ) : null}
      {hiddenCardCount > 0 || refEdgesTruncated ? (
        <div className="owb-lod-hint" role="status">
          {hiddenCardCount > 0 ? (
            <div>
              {t("Showing ${shown} of ${visible} cards. Zoom in to see all.", {
                shown: String(shownCount),
                visible: String(shownCount + hiddenCardCount),
              })}
            </div>
          ) : null}
          {refEdgesTruncated ? (
            <div>{t("Too many reference links; only some are shown.")}</div>
          ) : null}
        </div>
      ) : null}
      {filterActive ? (
        <CardFilterBanner
          tags={filterTags}
          matched={filterMatched}
          total={filterTotal}
          belowSearch={searchOpen}
          onClear={onClearFilter}
        />
      ) : null}
      {searchOpen ? (
        <CardSearchOverlay
          cards={viewCards}
          onPick={(cardBlockId: DbId) => {
            closeSearch();
            focusApiRef.current?.focusCard(cardBlockId);
          }}
          onClose={closeSearch}
        />
      ) : null}
      {outlineOpen ? (
        <SlideOutline
          rows={outlineRows}
          onPick={handleOutlinePick}
          onRemove={handleOutlineRemove}
          onReorder={handleOutlineReorder}
          onClose={closeOutline}
        />
      ) : null}
      <SelectionToolbar
        cards={interactiveCards}
        selectedIds={selected}
        onColor={applyCardColor}
        onUnifySize={applyUnifySize}
        onArrange={applyArrange}
        onWrapSelected={onWrapSelected}
      />
      <RelationMap
        boardBlockId={boardBlockId}
        cards={cards}
        selected={selected}
        onAddCards={onAddCards}
        selectCards={selectCards}
        focusApiRef={focusApiRef}
      />
    </>
  );
}

/** Host-level dialogs that must not be clipped by the viewport. */
export function CanvasHostOverlays({
  overlay,
  boardBlockId,
  cards,
  cardsRef,
  selected,
  focusApiRef,
  onAddCards,
  onPlaceJournalsAt,
  onStartDrawArea,
  createBlankAt,
  createMediaAt,
  selectCards,
  applyArrange,
  applyCardColor,
  applyUnifySize,
}: SharedProps & {
  onPlaceJournalsAt: (origin: CanvasOrigin) => void;
  onStartDrawArea: () => void;
  createBlankAt: (at: CanvasOrigin, edit: boolean) => Promise<void> | void;
  createMediaAt: (at: CanvasOrigin, kind: MediaKind) => Promise<void> | void;
}) {
  const {
    menuPointRef,
    boardMenuAt,
    setBoardMenuAt,
    addNoteAt,
    setAddNoteAt,
    openSearch,
  } = overlay;
  return (
    <>
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
          onInsertMedia: (kind: MediaKind) =>
            void createMediaAt(menuPointRef.current, kind),
          onNewSubBoard: () => {
            const at = menuPointRef.current;
            void placeNewSubBoardOnBoard({
              boardBlockId,
              x: at.x,
              y: at.y,
              addCards: onAddCards,
              selectCards,
            });
          },
          onAddFromNote: () => {
            setBoardMenuAt(null);
            setAddNoteAt(menuPointRef.current);
          },
          onPlaceJournals: () => onPlaceJournalsAt(menuPointRef.current),
          onDrawArea: onStartDrawArea,
          onFitAll: () => {
            focusApiRef.current?.fitAll();
          },
          onFind: openSearch,
          onColor: applyCardColor,
          onUnifySize: applyUnifySize,
        }}
      />
    </>
  );
}
