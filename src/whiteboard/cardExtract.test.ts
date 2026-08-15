import {
  CARD_HEIGHT,
  CARD_WIDTH,
  GRID_GAP,
} from "./layout.ts";
import { collectMissingCardTreeIds } from "./cardTreeLoad.ts";
import { planCardBlockTree } from "./cardTreePlan.ts";
import {
  cardIdsKey,
  encodeExtractPayload,
  findOwningCardId,
  findVacantCardPosition,
  hasAncestorInIds,
  hasExtractOrigin,
  isExtractableDepth,
  isParentBoardBlock,
  orcaBlocksPayload,
  parseExtractPayload,
  parseIdKey,
  parseOwbExtract,
  planExtractEdge,
  planExtractMoves,
  rectsOverlap,
  shouldExtractMove,
} from "./cardExtract.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const tree = {
  1: { children: [2, 3] },
  2: { children: [4] },
  3: { children: [] },
  4: { children: [5] },
  5: { children: [] },
};

check(isExtractableDepth(0) === false, "root row is not extractable");
check(isExtractableDepth(1) === true, "child row is extractable");
check(hasExtractOrigin({ parent: 10 }) === true, "note child can extract");
check(hasExtractOrigin({ parent: null }) === false, "page root stays in place");
check(hasExtractOrigin({}) === false, "missing parent stays in place");

check(cardIdsKey([{ blockId: 3 }, { blockId: 1 }]) === "1,3", "id key sorts");
check(cardIdsKey([]) === "", "empty id key");
check(
  [...parseIdKey("3,1")].sort((a, b) => a - b).join(",") === "1,3",
  "parse id key",
);
check(parseIdKey("").size === 0, "empty parse id key");

const encoded = encodeExtractPayload({ source: 10, block: 20 });
check(
  JSON.stringify(parseExtractPayload(encoded)) ===
    JSON.stringify({ source: 10, block: 20 }),
  "extract payload roundtrip",
);
check(parseExtractPayload("") == null, "empty extract payload");
check(parseExtractPayload("{") == null, "broken extract payload");
check(parseExtractPayload(JSON.stringify({ source: "x" })) == null, "bad ids");
check(orcaBlocksPayload([7, 8]) === JSON.stringify({ blocks: [7, 8] }), "orca payload");
check(
  orcaBlocksPayload([7], { source: 1, block: 7 }) ===
    JSON.stringify({ blocks: [7], owbExtract: { source: 1, block: 7 } }),
  "orca extract payload",
);
check(
  JSON.stringify(parseOwbExtract(orcaBlocksPayload([7], { source: 1, block: 7 }))) ===
    JSON.stringify({ source: 1, block: 7 }),
  "owbExtract roundtrip",
);
check(parseOwbExtract(orcaBlocksPayload([7])) == null, "plain orca payload is not extract");
check(parseOwbExtract("") == null, "empty owbExtract");
check(parseOwbExtract("{") == null, "broken owbExtract");

const owners = {
  1: { parent: null },
  2: { parent: 1 },
  3: { parent: 2 },
  4: { parent: 99 },
  5: { parent: 6 },
  6: { parent: 5 },
};
const cardIds = new Set([1]);
check(findOwningCardId(3, cardIds, owners) === 1, "nested child owns to card");
check(findOwningCardId(2, cardIds, owners) === 1, "direct child owns to card");
check(findOwningCardId(1, cardIds, owners) == null, "card itself has no owner");
check(findOwningCardId(4, cardIds, owners) == null, "outside tree has no owner");
check(
  findOwningCardId(5, new Set([1]), owners) == null,
  "cycle without a card stops",
);

const boardId = 100;
check(
  isParentBoardBlock({ parent: boardId }, boardId) === true,
  "parent board means already extracted",
);
check(
  isParentBoardBlock({ parent: 50 }, boardId) === false,
  "parent journal still needs extract",
);
check(
  isParentBoardBlock({ parent: null }, boardId) === false,
  "page root is not extracted under the board",
);
check(
  isParentBoardBlock(undefined, boardId) === false,
  "missing block is not extracted under the board",
);

const family = {
  50: { parent: null },
  51: { parent: 50 },
  52: { parent: 51 },
  60: { parent: null },
  61: { parent: 60 },
  62: { parent: 61 },
  1: { parent: 50 },
  2: { parent: 1 },
  3: { parent: 2 },
  7: { parent: boardId },
  8: { parent: 8 },
  80: { parent: null },
  90: { parent: 50 },
  98: { parent: 97 },
};
const onBoard = new Set<number>([1, 60, 7, 90]);
const noneOnBoard = new Set<number>();
check(
  hasAncestorInIds(3, new Set([1, 3]), family) === true,
  "grandchild has ancestor in the same drop",
);
check(
  hasAncestorInIds(3, new Set([3]), family) === false,
  "lone descendant has no ancestor in the drop",
);
check(
  hasAncestorInIds(1, new Set([1, 3]), family) === false,
  "parent is not an ancestor of itself",
);
check(
  hasAncestorInIds(8, new Set([1, 8]), family) === false,
  "parent cycle without an ancestor in the set stops",
);

check(
  shouldExtractMove({
    blockId: 2,
    boardBlockId: boardId,
    dragIds: new Set([2]),
    cardIds: onBoard,
    block: family[2],
    blocks: family,
  }) === true,
  "T1: child of a card already on the board is moved",
);
check(
  shouldExtractMove({
    blockId: 51,
    boardBlockId: boardId,
    dragIds: new Set([51]),
    cardIds: onBoard,
    block: family[51],
    blocks: family,
  }) === false,
  "T2: line from a note that is not a card on this board is not moved",
);
check(
  shouldExtractMove({
    blockId: 61,
    boardBlockId: boardId,
    dragIds: new Set([61]),
    cardIds: onBoard,
    block: family[61],
    blocks: family,
  }) === true,
  "T3: line from a journal that is itself a card on this board is moved",
);
check(
  shouldExtractMove({
    blockId: 80,
    boardBlockId: boardId,
    dragIds: new Set([80]),
    cardIds: onBoard,
    block: family[80],
    blocks: family,
  }) === false,
  "T4: page root is placed without a move",
);
check(
  shouldExtractMove({
    blockId: 50,
    boardBlockId: boardId,
    dragIds: new Set([50]),
    cardIds: onBoard,
    block: family[50],
    blocks: family,
  }) === false,
  "T4: journal root with no parent is placed without a move",
);
check(
  shouldExtractMove({
    blockId: 90,
    boardBlockId: boardId,
    dragIds: new Set([90]),
    cardIds: onBoard,
    block: family[90],
    blocks: family,
  }) === false,
  "T5: already-a-card whose body still lives in an off-board note is not moved",
);
check(
  shouldExtractMove({
    blockId: 2,
    boardBlockId: boardId,
    dragIds: new Set([2]),
    cardIds: noneOnBoard,
    block: family[2],
    blocks: family,
  }) === false,
  "T5: card still in a note is not moved when no ancestor card is on the board",
);
check(
  shouldExtractMove({
    blockId: 7,
    boardBlockId: boardId,
    dragIds: new Set([7]),
    cardIds: onBoard,
    sourceCardId: 1,
    block: family[7],
    blocks: family,
  }) === false,
  "T6: already under the whiteboard is not moved again",
);
check(
  shouldExtractMove({
    blockId: 3,
    boardBlockId: boardId,
    dragIds: new Set([2, 3]),
    cardIds: onBoard,
    block: family[3],
    blocks: family,
  }) === false,
  "T7: descendant dropped with an ancestor is not moved",
);
check(
  shouldExtractMove({
    blockId: 2,
    boardBlockId: boardId,
    dragIds: new Set([2, 3]),
    cardIds: onBoard,
    block: family[2],
    blocks: family,
  }) === true,
  "T7: parent in a parent+child drop is still moved when it has a board ancestor",
);
check(
  shouldExtractMove({
    blockId: 1,
    boardBlockId: boardId,
    dragIds: new Set([1, 3]),
    cardIds: noneOnBoard,
    block: family[1],
    blocks: family,
  }) === false,
  "parent in a parent+child drop is not moved without a board ancestor",
);
check(
  shouldExtractMove({
    blockId: 98,
    boardBlockId: boardId,
    dragIds: new Set([98]),
    cardIds: onBoard,
    sourceCardId: 1,
    block: family[98],
    blocks: family,
  }) === true,
  "extractRow sourceCardId on the board is a cache-miss fallback to move",
);
check(
  shouldExtractMove({
    blockId: 98,
    boardBlockId: boardId,
    dragIds: new Set([98]),
    cardIds: onBoard,
    sourceCardId: 999,
    block: family[98],
    blocks: family,
  }) === false,
  "sourceCardId that is not a card on this board does not force a move",
);
check(
  shouldExtractMove({
    blockId: 90,
    boardBlockId: boardId,
    dragIds: new Set([90]),
    cardIds: onBoard,
    sourceCardId: 90,
    block: family[90],
    blocks: family,
  }) === false,
  "sourceCardId equal to the block itself does not count as a board ancestor",
);

check(
  planExtractMoves([2], boardId, family, onBoard).join(",") === "2",
  "T1: lone child of an on-board card is moved",
);
check(
  planExtractMoves([51], boardId, family, onBoard).length === 0,
  "T2: line from an off-board note is not moved",
);
check(
  planExtractMoves([61], boardId, family, onBoard).join(",") === "61",
  "T3: line from an on-board journal card is moved",
);
check(
  planExtractMoves([80], boardId, family, onBoard).length === 0,
  "T4: page root is not moved",
);
check(
  planExtractMoves([90], boardId, family, onBoard).length === 0,
  "T5: already-a-card still living in an off-board note is not moved",
);
check(
  planExtractMoves([2], boardId, family, noneOnBoard).length === 0,
  "T5: nested block is not moved when no ancestor card is on the board",
);
check(
  planExtractMoves([7], boardId, family, onBoard).length === 0,
  "T6: already extracted card is not moved",
);
check(
  planExtractMoves([2, 3], boardId, family, onBoard).join(",") === "2",
  "T7: parent+child drop only moves the parent that has a board ancestor",
);
check(
  planExtractMoves([1, 3], boardId, family, noneOnBoard).length === 0,
  "parent+child drop moves nothing without a board ancestor",
);
check(
  planExtractMoves([98], boardId, family, onBoard, 1).join(",") === "98",
  "planExtractMoves uses sourceCardId fallback when ancestor walk misses",
);

check(
  planCardBlockTree(1, tree)
    .map((node) => node.id)
    .join(",") === "1,2,4,5,3",
  "plan without promoted is full tree",
);
check(
  planCardBlockTree(1, tree, 4, 80, new Set([2]))
    .map((node) => `${node.id}@${node.depth}`)
    .join(",") === "1@0,3@1",
  "promoted child and its subtree are hidden",
);
check(
  planCardBlockTree(1, tree, 4, 80, new Set([1, 2]))
    .map((node) => node.id)
    .join(",") === "1,3",
  "root stays even when listed as promoted",
);
check(
  planCardBlockTree(1, tree, 4, 80, new Set([4]))
    .map((node) => node.id)
    .join(",") === "1,2,3",
  "promoted grandchild hides only that branch",
);

check(
  collectMissingCardTreeIds([1], { 1: { children: [2] }, 2: { children: [3] } })
    .join(",") === "3",
  "load still requests missing grandchild",
);
check(
  collectMissingCardTreeIds(
    [1],
    { 1: { children: [2] }, 2: { children: [3] } },
    4,
    80,
    new Set(),
    new Set([2]),
  ).join(",") === "",
  "load does not walk a promoted subtree",
);
check(
  collectMissingCardTreeIds(
    [2],
    { 2: { children: [3] } },
    4,
    80,
    new Set(),
    new Set([2]),
  ).join(",") === "3",
  "a promoted id still loads when it is the card root",
);

const existingEdge = {
  id: "1-2-1",
  from: 1,
  to: 2,
  arrow: "end" as const,
};
const created = planExtractEdge(1, 3, [existingEdge]);
check(created != null && created.from === 1 && created.to === 3, "new edge");
check(created != null && created.arrow === "end", "edge arrow is end");
check(
  created != null && !("linked" in created),
  "extract edge is not linked",
);
check(planExtractEdge(1, 2, [existingEdge]) == null, "same pair skipped");
check(planExtractEdge(2, 1, [existingEdge]) == null, "reverse pair skipped");
check(planExtractEdge(4, 4, []) == null, "self loop skipped");

check(
  rectsOverlap(
    { x: 0, y: 0, w: 10, h: 10 },
    { x: 9, y: 0, w: 10, h: 10 },
  ) === true,
  "overlap",
);
check(
  rectsOverlap(
    { x: 0, y: 0, w: 10, h: 10 },
    { x: 10, y: 0, w: 10, h: 10 },
  ) === false,
  "touching is not overlap",
);

const emptyAt = findVacantCardPosition([]);
check(emptyAt.x === 0 && emptyAt.y === 0, "empty board origin");

const source = { x: 0, y: 0, w: CARD_WIDTH, h: CARD_HEIGHT };
const beside = findVacantCardPosition([source], source);
check(
  beside.x === CARD_WIDTH + GRID_GAP && beside.y === 0,
  "prefer slot to the right of the source card",
);

const blocked = {
  x: CARD_WIDTH + GRID_GAP,
  y: 0,
  w: CARD_WIDTH,
  h: CARD_HEIGHT,
};
const nextCol = findVacantCardPosition([source, blocked], source);
check(
  nextCol.x === (CARD_WIDTH + GRID_GAP) * 2 && nextCol.y === 0,
  "skip an occupied preferred slot",
);

console.log("cardExtract.test.ts ok");
