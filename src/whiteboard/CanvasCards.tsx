import type { DbId } from "../orca.d.ts";
import { Card } from "./Card";
import {
  WEEKDAY_LABELS_MON,
  type CanvasOrigin,
  type WhiteboardCard,
} from "./data";
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
  weekdayGuide?: CanvasOrigin | null;
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
};

export function CanvasCards({
  panelId,
  cards,
  shownCards,
  lodSimplified,
  weekdayGuide,
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
}: Props) {
  const promotedKey = cardIdsKey(cards);
  const treeRevByRoot = useVisibleCardTrees(
    cardTreeLoadIds(shownCards, {
      simplified: lodSimplified,
      keep: editingId,
    }),
    promotedKey,
  );

  return (
    <>
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
          treeRev={treeRevByRoot[card.blockId] ?? 0}
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
          onExtractRow={onExtractRow}
        />
      ))}
    </>
  );
}
