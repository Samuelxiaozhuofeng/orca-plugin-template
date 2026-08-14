import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import type { WhiteboardCard } from "./data";
import {
  completeBoardDrop,
  isLeavingDragTarget,
  isOrcaBlockDrag,
} from "./dropBlocks";

const { useCallback, useState } = window.React;

export function useBoardDrop(opts: {
  boardBlockId: DbId;
  cardsRef: { current: WhiteboardCard[] };
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  onAddCards: (cards: WhiteboardCard[]) => Promise<boolean>;
}): {
  dropActive: boolean;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
} {
  const [dropActive, setDropActive] = useState(false);
  const { boardBlockId, cardsRef, pointerToWorld, onAddCards } = opts;

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!isOrcaBlockDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDropActive(true);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (isLeavingDragTarget(event.currentTarget, event.relatedTarget)) {
      setDropActive(false);
    }
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDropActive(false);
      const at = pointerToWorld(event.clientX, event.clientY);
      const dataTransfer = event.dataTransfer;
      void completeBoardDrop({
        dataTransfer,
        at,
        existing: cardsRef.current,
        boardBlockId,
        addCards: onAddCards,
      }).catch((error: unknown) => {
        console.error("[whiteboard] failed to drop blocks", error);
        orca.notify(
          "error",
          error instanceof Error
            ? error.message
            : t("Failed to add blocks to the board"),
        );
      });
    },
    [boardBlockId, cardsRef, onAddCards, pointerToWorld],
  );

  return { dropActive, onDragOver, onDragLeave, onDrop };
}
