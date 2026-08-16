import type { DbId } from "../orca.d.ts";
import { resolveBoardDropTarget } from "./boardDropTarget";
import { getBoardSession } from "./boardSession";
import { boardPropsReadable } from "./boardWrite";
import type { WhiteboardCard } from "./cards";
import { isWhiteboardBlock } from "./pageBoardPlan";

export { resolveBoardDropTarget } from "./boardDropTarget";

/** Hover time on a board card before drop highlight arms. */
export const BOARD_DROP_HOVER_MS = 800;

export const BOARD_DROP_CLASS = "is-board-drop";

export function boardAAllowsDrop(boardId: DbId): boolean {
  const session = getBoardSession(boardId);
  if (session != null && (session.protect || !session.hydrated)) return false;
  return boardPropsReadable(orca.state.blocks[boardId]);
}

/** Same rule hover and apply use: no highlight unless the target can be written. */
export function boardTargetAllowsDrop(id: DbId): boolean {
  const session = getBoardSession(id);
  if (session != null) return !session.protect && session.hydrated;
  const block = orca.state.blocks[id];
  if (block == null) return false;
  if (!isWhiteboardBlock(block)) return false;
  return boardPropsReadable(block);
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
  onPointerWorld: (world: { x: number; y: number }, altHeld?: boolean) => void;
  armedTarget: () => DbId | null;
  dispose: () => void;
} {
  let candidate: DbId | null = null;
  let armed: DbId | null = null;
  let timer = 0;
  let lastWorld: { x: number; y: number } | null = null;

  const clearTimer = () => {
    if (timer === 0) return;
    window.clearTimeout(timer);
    timer = 0;
  };

  const paintArmed = (id: DbId | null) => {
    armed = id;
    setBoardDropHighlight(opts.canvas, id);
  };

  const resolve = (world: { x: number; y: number }, altHeld: boolean) => {
    lastWorld = world;
    const next = resolveBoardDropTarget({
      world,
      cards: opts.cards(),
      movingIds: opts.movingIds,
      currentBoardId: opts.currentBoardId,
      isBoardCard: boardTargetAllowsDrop,
      allowDrop: boardAAllowsDrop(opts.currentBoardId),
      altHeld,
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
  };

  const onAltKey = (event: KeyboardEvent) => {
    if (event.key !== "Alt" || lastWorld == null) return;
    resolve(lastWorld, event.type === "keydown" || event.altKey);
  };

  window.addEventListener("keydown", onAltKey);
  window.addEventListener("keyup", onAltKey);

  return {
    onPointerWorld(world, altHeld) {
      resolve(world, altHeld === true);
    },
    armedTarget: () => armed,
    dispose() {
      window.removeEventListener("keydown", onAltKey);
      window.removeEventListener("keyup", onAltKey);
      clearTimer();
      candidate = null;
      lastWorld = null;
      paintArmed(null);
    },
  };
}
