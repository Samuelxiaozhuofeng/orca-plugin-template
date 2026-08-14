import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  discardLastRecord,
  holdHistory,
  recordBefore,
} from "./boardHistory";
import type { WhiteboardCard } from "./data";
import { placeDroppedBlocks } from "./dropBlocks";
import type { DrawDropEmpty } from "./edgeGestures";
import {
  nextEdgeId,
  pairKey,
  type WhiteboardEdge,
} from "./edges";
import { addBlankCardToBoard } from "./newCard";

const { useEffect, useRef, useState } = window.React;

type Props = {
  drop: DrawDropEmpty | null;
  cards: WhiteboardCard[];
  boardBlockId: DbId;
  edges: WhiteboardEdge[];
  onAddCards: (cards: WhiteboardCard[]) => Promise<boolean>;
  onCommitEdges: (next: WhiteboardEdge[]) => Promise<boolean>;
  onClose: () => void;
};

function pointRect(x: number, y: number): DOMRect {
  return new DOMRect(x, y, 1, 1);
}

function parseSelectedId(value: unknown): DbId | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "") {
    const id = Number(value);
    if (Number.isFinite(id)) return id;
  }
  return null;
}

export function EdgeDropMenu({
  drop,
  cards,
  boardBlockId,
  edges,
  onAddCards,
  onCommitEdges,
  onClose,
}: Props) {
  const [picking, setPicking] = useState(false);
  const busyRef = useRef(false);
  const bodyRef = useRef(document.body);

  useEffect(() => {
    if (drop == null) setPicking(false);
  }, [drop]);

  if (drop == null) return null;

  const connectTo = async (toId: DbId) => {
    if (toId === drop.fromId) {
      orca.notify("info", t("Cannot connect a card to itself"));
      return;
    }
    if (
      edges.some(
        (edge: WhiteboardEdge) =>
          pairKey(edge.from, edge.to) === pairKey(drop.fromId, toId),
      )
    ) {
      orca.notify("info", t("These cards are already connected"));
      onClose();
      return;
    }
    const ok = await onCommitEdges([
      ...edges,
      {
        id: nextEdgeId(drop.fromId, toId, edges),
        from: drop.fromId,
        to: toId,
        arrow: "end",
        fromSide: drop.fromSide,
      },
    ]);
    if (ok) onClose();
  };

  const createAndConnect = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    recordBefore(boardBlockId, { cards, edges });
    const release = holdHistory();
    try {
      const card = await addBlankCardToBoard({
        boardBlockId,
        x: drop.world.x,
        y: drop.world.y,
        addCards: onAddCards,
      });
      if (card == null) {
        discardLastRecord(boardBlockId);
        return;
      }
      await connectTo(card.blockId);
    } catch (error) {
      console.error("[whiteboard] drop-create card failed", error);
      orca.notify(
        "error",
        error instanceof Error ? error.message : t("Failed to create a new card"),
      );
      discardLastRecord(boardBlockId);
    } finally {
      release();
      busyRef.current = false;
    }
  };

  const pickExisting = async (blockId: DbId) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      if (blockId === boardBlockId) {
        orca.notify("info", t("Cannot place this board on itself"));
        return;
      }
      const existing = cards.find(
        (card: WhiteboardCard) => card.blockId === blockId,
      );
      if (existing != null) {
        await connectTo(blockId);
        return;
      }
      recordBefore(boardBlockId, { cards, edges });
      const release = holdHistory();
      try {
        const result = await placeDroppedBlocks({
          ids: [blockId],
          at: drop.world,
          existing: cards,
          boardBlockId,
        });
        if (result.incoming.length === 0) {
          discardLastRecord(boardBlockId);
          orca.notify("info", t("Nothing to add to the board"));
          return;
        }
        const saved = await onAddCards(result.incoming);
        if (!saved) {
          discardLastRecord(boardBlockId);
          return;
        }
        await connectTo(blockId);
      } finally {
        release();
      }
    } catch (error) {
      console.error("[whiteboard] drop-connect existing failed", error);
      orca.notify(
        "error",
        error instanceof Error
          ? error.message
          : t("Failed to add blocks to the board"),
      );
      discardLastRecord(boardBlockId);
    } finally {
      busyRef.current = false;
    }
  };

  return (
    <>
      <orca.components.Popup
        visible={!picking}
        rect={pointRect(drop.clientX, drop.clientY)}
        container={bodyRef}
        allowBeyondContainer
        escapeToClose
        defaultPlacement="bottom"
        alignment="left"
        onClose={onClose}
      >
        <orca.components.Menu>
          <orca.components.MenuText
            title={t("Create card and connect")}
            preIcon="ti ti-square-plus"
            onClick={() => {
              void createAndConnect();
            }}
          />
          <orca.components.MenuText
            title={t("Connect to an existing block")}
            preIcon="ti ti-search"
            onClick={() => setPicking(true)}
          />
          <orca.components.MenuSeparator />
          <orca.components.MenuText title={t("Cancel")} onClick={onClose} />
        </orca.components.Menu>
      </orca.components.Popup>
      <orca.components.ModalOverlay
        visible={picking}
        canClose
        onClose={() => setPicking(false)}
      >
        <div className="owb-dialog" role="dialog">
          <div className="owb-dialog-title">
            {t("Connect to an existing block")}
          </div>
          <orca.components.BlockSelect
            mode="block"
            selected={[]}
            placeholder={t("Search blocks")}
            onChange={(selected) => {
              const id = parseSelectedId(selected[0]);
              if (id == null) return;
              void pickExisting(id);
            }}
          />
        </div>
      </orca.components.ModalOverlay>
    </>
  );
}
