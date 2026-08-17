import type { DbId } from "../orca.d.ts";
import type { useCanvasOverlayState } from "./CanvasOverlays";
import type { CanvasFocusApi } from "./cardFocus";
import type { UnifySizeMode } from "./cardBatch";
import type { WhiteboardCard } from "./data";
import type { WhiteboardEdge } from "./edges";
import type { ArrangeAction } from "./selection";

export type CanvasOverlayProps = {
  overlay: ReturnType<typeof useCanvasOverlayState>;
  boardBlockId: DbId;
  cards: WhiteboardCard[];
  viewCards: WhiteboardCard[];
  interactiveCards: WhiteboardCard[];
  cardsRef: { current: WhiteboardCard[] };
  selected: DbId[];
  selectCards: (ids: DbId[]) => void;
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

/**
 * Packages canvas state into props shared by both overlay components.
 */
export function buildCanvasOverlayProps(opts: {
  overlay: ReturnType<typeof useCanvasOverlayState>;
  boardBlockId: DbId;
  cards: WhiteboardCard[];
  viewCards: WhiteboardCard[];
  interactiveCards: WhiteboardCard[];
  cardsRef: { current: WhiteboardCard[] };
  selected: DbId[];
  selectCards: (ids: DbId[]) => void;
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
  filter: {
    active: boolean;
    query: { tags: readonly string[] };
    matchedCount: number;
    totalCount: number;
    clear: () => void;
  };
}): CanvasOverlayProps {
  return {
    overlay: opts.overlay,
    boardBlockId: opts.boardBlockId,
    cards: opts.cards,
    viewCards: opts.viewCards,
    interactiveCards: opts.interactiveCards,
    cardsRef: opts.cardsRef,
    selected: opts.selected,
    selectCards: opts.selectCards,
    edges: opts.edges,
    focusApiRef: opts.focusApiRef,
    onAddCards: opts.onAddCards,
    onCommitEdges: opts.onCommitEdges,
    applyCardColor: opts.applyCardColor,
    applyUnifySize: opts.applyUnifySize,
    applyArrange: opts.applyArrange,
    onWrapSelected: opts.onWrapSelected,
    filterActive: opts.filter.active,
    filterTags: opts.filter.query.tags,
    filterMatched: opts.filter.matchedCount,
    filterTotal: opts.filter.totalCount,
    onClearFilter: opts.filter.clear,
  };
}
