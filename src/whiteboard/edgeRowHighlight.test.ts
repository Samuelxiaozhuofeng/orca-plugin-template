import {
  deriveTargetHighlightedRows,
  type HighlightEdgeInput,
} from "./edgeRowHighlight.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const edges: HighlightEdgeInput[] = [
  // Card 1 row 101 points to Card 2
  { from: 1, to: 2, fromBlock: 101 },
  // Card 3 row 301 points to Card 2 (multiple sources to same target)
  { from: 3, to: 2, fromBlock: 301 },
  // Card 1 points to Card 4 (card-to-card, no fromBlock)
  { from: 1, to: 4 },
  // Card 5 row 501 points to Card 6
  { from: 5, to: 6, fromBlock: 501 },
];

const refEdges: HighlightEdgeInput[] = [
  // Implicit ref edge: Card 7 row 701 points to Card 2
  { from: 7, to: 2, fromBlock: 701 },
];

const allEdges = [...edges, ...refEdges];

// 1. Selecting target card (Card 2) -> highlights source rows (101, 301, and ref 701)
{
  const result = deriveTargetHighlightedRows(allEdges, new Set([2]));
  check(result.size === 3, "should highlight 3 rows for target Card 2");
  check(result.has(101), "row 101 is highlighted");
  check(result.has(301), "row 301 is highlighted");
  check(result.has(701), "implicit ref row 701 is highlighted");
}

// 2. Selecting source card (Card 1) -> does NOT highlight its own row
{
  const result = deriveTargetHighlightedRows(allEdges, new Set([1]));
  check(result.size === 0, "selecting source card does not highlight its own row");
}

// 3. Selecting Card 4 (connected by edge without fromBlock) -> does not highlight anything
{
  const result = deriveTargetHighlightedRows(allEdges, new Set([4]));
  check(result.size === 0, "edges without fromBlock do not participate in highlighting");
}

// 4. Multiple cards selected (Card 2 and Card 6) -> highlights rows for both targets
{
  const result = deriveTargetHighlightedRows(allEdges, [2, 6]);
  check(result.size === 4, "should highlight rows for both Card 2 and Card 6");
  check(result.has(101), "row 101 is highlighted");
  check(result.has(301), "row 301 is highlighted");
  check(result.has(701), "row 701 is highlighted");
  check(result.has(501), "row 501 is highlighted");
}

// 5. Empty selection -> returns empty set
{
  const result = deriveTargetHighlightedRows(allEdges, new Set());
  check(result.size === 0, "empty selection returns empty set");
}

// 6. Selected card is not connected by any edge -> returns empty set
{
  const result = deriveTargetHighlightedRows(allEdges, new Set([999]));
  check(result.size === 0, "unconnected card selection returns empty set");
}

// 7. Empty edge list -> returns empty set
{
  const result = deriveTargetHighlightedRows([], new Set([2]));
  check(result.size === 0, "empty edges list returns empty set");
}

console.log("edgeRowHighlight.test.ts ok");
