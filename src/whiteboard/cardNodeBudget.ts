import { CARD_TREE_LOAD_MAX_NODES } from "./cardTreeQueue.ts";

/** Rough rendered height of one card row. Used to size the render budget. */
export const CARD_ROW_HEIGHT_EST = 28;

/** Card chrome above the scrolling body (title row, padding). */
export const CARD_HEADER_HEIGHT_EST = 44;

/**
 * Rows rendered past the visible window. Must stay > 0: it is what makes the
 * card body overflow, which is what gives the user something to scroll and so
 * lets the budget grow at all.
 */
export const CARD_ROW_PREFETCH = 6;

/** Floor, so a very short card still renders something useful. */
export const CARD_NODE_BUDGET_MIN = 12;

/** One growth step, applied when the user scrolls near the card's bottom. */
export const CARD_NODE_BUDGET_STEP = 16;

/**
 * Calculate the planning block node budget for a card from its height and
 * accumulated scroll growth steps.
 */
export function cardRenderNodeBudget(cardHeight: number, grown = 0): number {
  if (!Number.isFinite(cardHeight) || cardHeight <= 0) {
    return CARD_TREE_LOAD_MAX_NODES;
  }
  const safeGrown = !Number.isFinite(grown) || grown < 0 ? 0 : grown;
  const rows = Math.ceil(
    Math.max(0, cardHeight - CARD_HEADER_HEIGHT_EST) / CARD_ROW_HEIGHT_EST,
  );
  const target = rows + CARD_ROW_PREFETCH + safeGrown;
  return Math.min(
    CARD_TREE_LOAD_MAX_NODES,
    Math.max(CARD_NODE_BUDGET_MIN, target),
  );
}
