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
  isExtractableDepth,
  orcaBlocksPayload,
  parseExtractPayload,
  parseIdKey,
  parseOwbExtract,
  planExtractEdge,
  rectsOverlap,
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

check(
  planCardBlockTree(1, tree)
    .map((node) => node.id)
    .join(",") === "1,2,4,5,3",
  "plan without promoted is full tree",
);
check(
  planCardBlockTree(1, tree, 4, 80, new Set([2]))
    .map((node) => `${node.id}@${node.depth}${node.promoted ? "p" : ""}`)
    .join(",") === "1@0,2@1p,3@1",
  "promoted child is a placeholder and its subtree is hidden",
);
check(
  planCardBlockTree(1, tree, 4, 80, new Set([1, 2]))
    .map((node) => `${node.id}${node.promoted ? "p" : ""}`)
    .join(",") === "1,2p,3",
  "root stays even when listed as promoted",
);
check(
  planCardBlockTree(1, tree, 4, 80, new Set([4]))
    .map((node) => `${node.id}${node.promoted ? "p" : ""}`)
    .join(",") === "1,2,4p,3",
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
    [1],
    { 1: { children: [2] } },
    4,
    80,
    new Set(),
    new Set([2]),
  ).join(",") === "2",
  "load still requests a missing promoted child",
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
