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

const { useCallback, useEffect, useRef, useState } = window.React;

/** Search / menu / add-note state, plus find-command registration for this panel. */
export function useCanvasOverlayState(panelId: string) {
  const menuPointRef = useRef<CanvasOrigin>({ x: 0, y: 0 });
  const [boardMenuAt, setBoardMenuAt] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [addNoteAt, setAddNoteAt] = useState<CanvasOrigin | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(
    () => registerFindCardAction(panelId, openSearch),
    [openSearch, panelId],
  );

  const openBoardMenu = useCallback(
    (client: { x: number; y: number }, world: CanvasOrigin) => {
      menuPointRef.current = world;
      setBoardMenuAt(client);
    },
    [],
  );

  return {
    menuPointRef,
    boardMenuAt,
    setBoardMenuAt,
    addNoteAt,
    setAddNoteAt,
    searchOpen,
    openSearch,
    closeSearch,
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
  edges: WhiteboardEdge[];
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
  edges,
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
  const { searchOpen, closeSearch } = overlay;
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
              "Use the toolbar to place journals, or drag blocks here from a note.",
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
      <SelectionToolbar
        cards={interactiveCards}
        selectedIds={selected}
        onColor={applyCardColor}
        onUnifySize={applyUnifySize}
        onArrange={applyArrange}
        onWrapSelected={onWrapSelected}
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
  selectCards,
  applyArrange,
  applyCardColor,
  applyUnifySize,
}: SharedProps & {
  onPlaceJournalsAt: (origin: CanvasOrigin) => void;
  onStartDrawArea: () => void;
  createBlankAt: (at: CanvasOrigin, edit: boolean) => Promise<void> | void;
  selectCards: (ids: DbId[]) => void;
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
