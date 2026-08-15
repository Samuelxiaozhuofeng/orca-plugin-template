import type { DbId } from "../orca.d.ts";

/** Highlighted card-tree row that is already its own card on this board. */
export const CARD_ROW_ON_BOARD_CLASS = "is-on-board";

/** Marks the row itself as the jump target; gestures skip this class. */
export const CARD_ROW_FOCUS_CLASS = "owb-card-row-focus";

/**
 * True when this tree row is some other card on the current board.
 * Missing / empty card lists stay unmarked. The card's own root never
 * highlights itself.
 */
export function isCardRowOnBoard(
  rowBlockId: DbId,
  rootBlockId: DbId,
  boardCardIds: ReadonlySet<DbId> | null | undefined,
): boolean {
  if (boardCardIds == null || boardCardIds.size === 0) return false;
  if (typeof rowBlockId !== "number" || !Number.isFinite(rowBlockId)) {
    return false;
  }
  if (rowBlockId === rootBlockId) return false;
  return boardCardIds.has(rowBlockId);
}

/** In-card only. Outline / host notes never match these selectors. */
export const CARD_ROW_ON_BOARD_CSS = `
.owb-card-block-node.is-on-board {
  background-color: color-mix(in srgb, var(--orca-color-primary-5, #2F80ED) 10%, transparent);
  box-shadow: inset 2.5px 0 0 0 var(--orca-color-primary-5, #2F80ED);
  border-radius: 3px;
}

.owb-card-block-node.is-on-board {
  cursor: pointer;
}

.owb-card-block-node.is-on-board:hover {
  background-color: color-mix(in srgb, var(--orca-color-primary-5, #2F80ED) 18%, transparent);
}
`.trim();
