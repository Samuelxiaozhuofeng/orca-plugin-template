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
  background: transparent;
  box-shadow: none;
  padding-top: 2px;
  padding-bottom: 2px;
  cursor: pointer;
}

.owb-card-block-node.is-on-board .owb-extract-bullet.is-root {
  background: var(--orca-color-text-2, #666);
  opacity: 0.3;
}

.owb-card-block-node.is-on-board .owb-card-ref-row {
  display: inline-block;
  flex: 0 1 auto;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 1.5px 8px;
  background: color-mix(in srgb, var(--orca-color-bg-2, #f5f5f7) 60%, var(--orca-color-bg-1, #fff));
  border: 1px solid var(--orca-color-text-1, #1a1a1a);
  border-radius: 6px;
  box-shadow: 1.5px 1.5px 0px 0px color-mix(in srgb, var(--orca-color-text-1, #1a1a1a) 80%, transparent);
  color: var(--orca-color-text-1, #1a1a1a);
  font-size: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s ease;
}

.owb-card-block-node.is-on-board:hover .owb-card-ref-row,
.owb-card-block-node.is-on-board .owb-card-ref-row:hover {
  background: color-mix(in srgb, var(--orca-color-primary-5, #2F80ED) 10%, var(--orca-color-bg-1, #fff));
  border-color: var(--orca-color-primary-5, #2F80ED);
  box-shadow: 2px 2px 0px 0px var(--orca-color-primary-5, #2F80ED);
}

.owb-card-block-node.is-on-board:active .owb-card-ref-row {
  transform: translate(1.5px, 1.5px);
  box-shadow: 0px 0px 0px 0px transparent;
}
`.trim();
