import type { DbId } from "../orca.d.ts";
import { Card } from "./Card";
import {
  WEEKDAY_LABELS_MON,
  type CanvasOrigin,
  type WhiteboardCard,
} from "./data";
import type { CardBox } from "./edgeGeometry";
import type { Side } from "./edges";
import type { ArrangeAction } from "./selection";
import type { CardPatchEntry } from "./useCanvasPointer";
import type { EdgeLayerApi } from "./EdgeLayer";

type Props = {
  panelId: string;
  shownCards: WhiteboardCard[];
  weekdayGuide?: CanvasOrigin | null;
  degraded: boolean;
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
  applyArrange: (action: ArrangeAction) => void;
  onMoveFrame: (boxes: Map<DbId, CardBox>) => void;
  edgeApiRef: { current: EdgeLayerApi | null };
};

export function CanvasCards({
  panelId,
  shownCards,
  weekdayGuide,
  degraded,
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
  applyArrange,
  onMoveFrame,
  edgeApiRef,
}: Props) {
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
            selectEdge(null);
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
    </>
  );
}
