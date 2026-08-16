import type { DbId } from "../orca.d.ts";
import { getBoardSession } from "./boardSession";
import { boardPropsReadable } from "./boardWrite";
import type { WhiteboardCard } from "./cards";
import { hitCardAt } from "./edgeGeometry";
import { isWhiteboardBlock } from "./pageBoardPlan";

/** Hover time on a board card before drop highlight arms. */
export const BOARD_DROP_HOVER_MS = 400;

export const BOARD_DROP_CLASS = "is-board-drop";

export function boardAAllowsDrop(boardId: DbId): boolean {
  const session = getBoardSession(boardId);
  if (session != null && (session.protect || !session.hydrated)) return false;
  return boardPropsReadable(orca.state.blocks[boardId]);
}

export function resolveBoardDropTarget(opts: {
  world: { x: number; y: number };
  cards: ReadonlyArray<{ blockId: DbId; x: number; y: number; w: number; h: number }>;
  movingIds: ReadonlySet<DbId>;
  currentBoardId: DbId;
  isBoardCard: (id: DbId) => boolean;
  allowDrop: boolean;
}): DbId | null {
  if (!opts.allowDrop) return null;
  const candidates = opts.cards.filter((card) => !opts.movingIds.has(card.blockId));
  const hit = hitCardAt(candidates, opts.world);
  if (hit == null) return null;
  if (hit === opts.currentBoardId) return null;
  if (!opts.isBoardCard(hit)) return null;
  const remaining = [...opts.movingIds].filter((id) => id !== hit);
  if (remaining.length === 0) return null;
  return hit;
}

export function setBoardDropHighlight(
  canvas: HTMLElement | null,
  id: DbId | null,
): void {
  if (canvas == null) return;
  for (const el of canvas.querySelectorAll(`.owb-card.${BOARD_DROP_CLASS}`)) {
    const raw = (el as HTMLElement).dataset.blockId;
    const cur = raw == null ? Number.NaN : Number(raw);
    if (id != null && Number.isFinite(cur) && cur === id) continue;
    el.classList.remove(BOARD_DROP_CLASS);
  }
  if (id == null) return;
  const el = canvas.querySelector(`[data-block-id="${id}"]`);
  el?.classList.add(BOARD_DROP_CLASS);
}

export function createBoardDropHover(opts: {
  canvas: HTMLElement;
  cards: () => readonly WhiteboardCard[];
  movingIds: ReadonlySet<DbId>;
  currentBoardId: DbId;
}): {
  onPointerWorld: (world: { x: number; y: number }) => void;
  armedTarget: () => DbId | null;
  dispose: () => void;
} {
  let candidate: DbId | null = null;
  let armed: DbId | null = null;
  let timer = 0;

  const clearTimer = () => {
    if (timer === 0) return;
    window.clearTimeout(timer);
    timer = 0;
  };

  const paintArmed = (id: DbId | null) => {
    armed = id;
    setBoardDropHighlight(opts.canvas, id);
  };

  return {
    onPointerWorld(world) {
      const next = resolveBoardDropTarget({
        world,
        cards: opts.cards(),
        movingIds: opts.movingIds,
        currentBoardId: opts.currentBoardId,
        isBoardCard: (id) => {
          if (getBoardSession(id)?.protect === true) return false;
          return isWhiteboardBlock(orca.state.blocks[id]);
        },
        allowDrop: boardAAllowsDrop(opts.currentBoardId),
      });
      if (next === candidate) return;
      candidate = next;
      clearTimer();
      paintArmed(null);
      if (next == null) return;
      timer = window.setTimeout(() => {
        timer = 0;
        if (candidate === next) paintArmed(next);
      }, BOARD_DROP_HOVER_MS);
    },
    armedTarget: () => armed,
    dispose() {
      clearTimer();
      candidate = null;
      paintArmed(null);
    },
  };
}
