import type { DbId } from "../orca.d.ts";

export type CardDragMove = { blockId: DbId; x: number; y: number };

export type CardDragEndDecision =
  | { kind: "idle" }
  | { kind: "move"; moves: ReadonlyArray<CardDragMove> }
  | {
      kind: "try-drop";
      target: DbId;
      /** Apply these only when the drop is not a drop (caller gets `false`). */
      movesIfUnhandled: ReadonlyArray<CardDragMove>;
    };

/**
 * Decide how a finished card drag should land.
 * Alt/Option always stays a regular move. A drop is only attempted when the
 * hover is still armed at mouseup.
 */
export function decideCardDragEnd(opts: {
  dragged: boolean;
  armedTarget: DbId | null;
  altKey: boolean;
  canDrop: boolean;
  moves: ReadonlyArray<CardDragMove>;
}): CardDragEndDecision {
  if (!opts.dragged) return { kind: "idle" };
  if (
    opts.canDrop &&
    !opts.altKey &&
    opts.armedTarget != null
  ) {
    return {
      kind: "try-drop",
      target: opts.armedTarget,
      movesIfUnhandled: opts.moves,
    };
  }
  return { kind: "move", moves: opts.moves };
}
