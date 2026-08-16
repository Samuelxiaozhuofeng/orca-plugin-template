import type { DbId } from "../orca.d.ts";
import { createBoardDropHover } from "./boardDropHover";
import { decideCardDragEnd } from "./cardDragEnd";
import { cardMovesLocked, lockCardMoves, unlockCardMoves } from "./cardDropLock";
import { restoreCardBoxes, startMoveCards } from "./cardGestures";
import type { WhiteboardCard } from "./data";
import type { CardRect } from "./selection";
import type { WhiteboardSettings } from "./settings";
import type { PatchCardsFn } from "./useCanvasPointer";
import type { CanvasView } from "./viewTransform";

/**
 * Starts dragging the current selection and finishes as a move or a drop.
 */
export function beginCardMoveSelection(opts: {
  startX: number;
  startY: number;
  canvas: HTMLElement;
  guidesEl: HTMLElement | null;
  boardBlockId: DbId;
  selected: readonly DbId[];
  liveCards: () => readonly WhiteboardCard[];
  settings: () => WhiteboardSettings;
  liveView: () => CanvasView;
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  mounted: () => boolean;
  onMoveFrame?: (boxes: Map<DbId, CardRect>) => void;
  onPatchCards: PatchCardsFn;
  onClick?: (event: MouseEvent) => void;
  onDropOntoBoard?: (
    targetBoardId: DbId,
    movingIds: readonly DbId[],
  ) => Promise<boolean>;
  setHover: (hover: { dispose: () => void } | null) => void;
}): void {
  const movingIds = new Set(opts.selected);
  if (cardMovesLocked(movingIds)) return;
  const cards = opts.liveCards();
  const moving = cards.filter((item) => movingIds.has(item.blockId));
  if (moving.length === 0) return;
  const others = cards.filter((item) => !movingIds.has(item.blockId));

  const hover = createBoardDropHover({
    canvas: opts.canvas,
    cards: opts.liveCards,
    movingIds,
    currentBoardId: opts.boardBlockId,
  });
  opts.setHover(hover);

  const applyMoves = (
    moves: ReadonlyArray<{ blockId: DbId; x: number; y: number }>,
  ) => {
    if (!opts.mounted() || moves.length === 0) return;
    opts.onPatchCards(
      moves.map((item) => ({
        blockId: item.blockId,
        patch: { x: item.x, y: item.y },
      })),
    );
  };

  startMoveCards({
    startX: opts.startX,
    startY: opts.startY,
    canvas: opts.canvas,
    guidesEl: opts.guidesEl,
    showGuides: () => opts.settings().showAlignGuides,
    moving,
    others,
    pointerToWorld: opts.pointerToWorld,
    view: opts.liveView,
    onFrame: (boxes, world, alt) => {
      opts.onMoveFrame?.(boxes);
      hover.onPointerWorld(world, alt);
    },
    onClick: opts.onClick,
    onEnd: (end) => {
      const target = hover.armedTarget();
      hover.dispose();
      opts.setHover(null);
      if (!opts.mounted()) return;
      const decision = decideCardDragEnd({
        dragged: end.dragged,
        armedTarget: target,
        altKey: end.altKey,
        canDrop: opts.onDropOntoBoard != null,
        moves: end.moves,
      });
      if (decision.kind !== "try-drop" || opts.onDropOntoBoard == null) {
        if (decision.kind === "move") applyMoves(decision.moves);
        return;
      }
      restoreCardBoxes(opts.canvas, moving);
      const ids = [...movingIds];
      lockCardMoves(ids);
      void opts
        .onDropOntoBoard(decision.target, ids)
        .then((handled) => {
          if (!handled) applyMoves(decision.movesIfUnhandled);
        })
        .catch((err: unknown) => {
          console.error("[whiteboard] drop onto board failed", err);
          applyMoves(decision.movesIfUnhandled);
        })
        .finally(() => {
          unlockCardMoves(ids);
        });
    },
  });
}
