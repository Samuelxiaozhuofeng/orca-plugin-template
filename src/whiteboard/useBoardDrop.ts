import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { completeCanvasDrop } from "./cardExtractApply";
import type { WhiteboardCard } from "./data";
import { isLeavingDragTarget, isOrcaBlockDrag } from "./dropBlocks";
import type { WhiteboardEdge } from "./edges";

const { useCallback, useState } = window.React;

/**
 * Blocks rendered inside a card live outside any Orca block editor, so the
 * host's own droppable handlers (BlockShell `useDroppable`) crash when a drag
 * passes over them: they read `BlockEditorContext.container.current`, and that
 * context is empty here. Orca only skips them for its own whiteboard repr
 * (contentClassName check), which we cannot set, so the board swallows drag
 * events aimed at card content before they reach the host handlers.
 */
function isCardTreeTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest(".owb-card-block-tree") != null
  );
}

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
  onDragEnterCapture: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOverCapture: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeaveCapture: (event: React.DragEvent<HTMLDivElement>) => void;
  onDropCapture: (event: React.DragEvent<HTMLDivElement>) => void;
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
      const drop = completeCanvasDrop({
        dataTransfer: event.dataTransfer,
        at,
        existing: cardsRef.current,
        existingEdges: edgesRef.current,
        boardBlockId,
        addCards: onAddCards,
        commitEdges: onCommitEdges,
      });
      void drop.catch((error: unknown) => {
        console.error("[whiteboard] failed to drop blocks", error);
        orca.notify("error", t("Failed to add blocks to the board"));
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

  const onDragEnterCapture = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (isCardTreeTarget(event.target)) event.stopPropagation();
    },
    [],
  );

  const onDragOverCapture = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isCardTreeTarget(event.target)) return;
      event.stopPropagation();
      onDragOver(event);
    },
    [onDragOver],
  );

  const onDragLeaveCapture = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isCardTreeTarget(event.target)) return;
      event.stopPropagation();
      onDragLeave(event);
    },
    [onDragLeave],
  );

  const onDropCapture = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isCardTreeTarget(event.target)) return;
      event.stopPropagation();
      onDrop(event);
    },
    [onDrop],
  );

  return {
    dropActive,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnterCapture,
    onDragOverCapture,
    onDragLeaveCapture,
    onDropCapture,
  };
}
