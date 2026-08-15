import type { DbId } from "../orca.d.ts";
import { Card } from "./Card";
import type { WhiteboardCard } from "./data";
import type { CardBox } from "./edgeGeometry";
import type { ArrangeAction } from "./selection";
import type { CardPatchEntry } from "./useCanvasPointer";
import type { EdgeLayerApi } from "./EdgeLayer";
import { cardIdsKey } from "./cardExtract";
import { cardTreeLoadIds, useVisibleCardTrees } from "./cardTreeLoad";

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
}: Props) {
  const promotedKey = cardIdsKey(cards);
  const cardTrees = useVisibleCardTrees(
    cardTreeLoadIds(shownCards, {
      simplified: lodSimplified,
      keep: editingId,
    }),
    promotedKey,
  );

  return (
    <>
      {shownCards.map((card: WhiteboardCard) => (
        <Card
          key={card.blockId}
          panelId={panelId}
          card={card}
          treeRev={cardTrees.revByRoot[card.blockId] ?? 0}
          loadRetrying={cardTrees.retryingRootSet.has(card.blockId)}
          onRetryLoad={cardTrees.retryRoot}
          editing={editingId === card.blockId}
          simplified={lodSimplified && editingId !== card.blockId}
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
          ) => {
            edgeApiRef.current?.startDraw(
              card,
              undefined,
              event.clientX,
              event.clientY,
              mode === "click" ? "mousedown" : "mouseup",
            );
          }}
          promotedKey={promotedKey}
          onFocusCard={onFocusCard}
          onExtractRow={onExtractRow}
          onWrapSelected={onWrapSelected}
        />
      ))}
    </>
  );
}
