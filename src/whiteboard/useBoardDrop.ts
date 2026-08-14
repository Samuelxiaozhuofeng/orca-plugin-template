import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { isExtractDrag } from "./cardExtract";
import { completeExtractDrop } from "./cardExtractApply";
import type { WhiteboardCard } from "./data";
import {
  completeBoardDrop,
  isLeavingDragTarget,
  isOrcaBlockDrag,
} from "./dropBlocks";
import type { WhiteboardEdge } from "./edges";

const { useCallback, useState } = window.React;

export function useBoardDrop(opts: {
  boardBlockId: DbId;
  cardsRef: { current: WhiteboardCard[] };
  edgesRef: { current: WhiteboardEdge[] };
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  onAddCards: (cards: WhiteboardCard[]) => Promise<boolean>;
  onCommitEdges: (next: WhiteboardEdge[]) => Promise<boolean>;
}): {
  dropActive: boolean;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
} {
  const [dropActive, setDropActive] = useState(false);
  const {
    boardBlockId,
    cardsRef,
    edgesRef,
    pointerToWorld,
    onAddCards,
    onCommitEdges,
  } = opts;

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
      const drop = isExtractDrag(dataTransfer)
        ? completeExtractDrop({
            dataTransfer,
            at,
            existing: cardsRef.current,
            existingEdges: edgesRef.current,
            boardBlockId,
            addCards: onAddCards,
            commitEdges: onCommitEdges,
          })
        : completeBoardDrop({
            dataTransfer,
            at,
            existing: cardsRef.current,
            boardBlockId,
            addCards: onAddCards,
          });
      void drop.catch((error: unknown) => {
        console.error("[whiteboard] failed to drop blocks", error);
        orca.notify(
          "error",
          error instanceof Error
            ? error.message
            : t("Failed to add blocks to the board"),
        );
      });
    },
    [
      boardBlockId,
      cardsRef,
      edgesRef,
      onAddCards,
      onCommitEdges,
      pointerToWorld,
    ],
  );

  return { dropActive, onDragOver, onDragLeave, onDrop };
}
