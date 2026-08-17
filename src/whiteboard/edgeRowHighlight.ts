import type { DbId } from "../orca.d.ts";

export type HighlightEdgeInput = {
  from: DbId;
  to: DbId;
  fromBlock?: DbId;
};

/**
 * Derives the set of row block IDs (`fromBlock`) that should be highlighted
 * because their destination card (`to`) is currently selected.
 *
 * Rules:
 * 1. Triggered when the destination card (`to`) is in `selectedCardIds`.
 * 2. Only edges with `fromBlock != null` produce highlighted rows.
 * 3. Selecting the source card (`from`) does NOT highlight the row.
 * 4. Supports both manual edges and reference edges (refEdges).
 */
export function deriveTargetHighlightedRows(
  edges: readonly HighlightEdgeInput[],
  selectedCardIds: ReadonlySet<DbId> | readonly DbId[],
): Set<DbId> {
  const highlighted = new Set<DbId>();
  const selectedSet =
    selectedCardIds instanceof Set
      ? selectedCardIds
      : new Set(selectedCardIds);

  if (selectedSet.size === 0 || edges.length === 0) {
    return highlighted;
  }

  for (const edge of edges) {
    if (edge.fromBlock != null && selectedSet.has(edge.to)) {
      highlighted.add(edge.fromBlock);
    }
  }

  return highlighted;
}
