import {
  cardTreePlanEqual,
  FOLDING_HANDLE_CLASS,
  FOLDING_HANDLE_SELECTOR,
  hostDrawsOwnChildren,
  isBlockFolded,
  planCardBlockTree,
  type CardTreeLookup,
} from "./cardTreePlan.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

// 1. Selector constants
check(
  FOLDING_HANDLE_CLASS === "orca-block-folding-handle",
  "FOLDING_HANDLE_CLASS matches host Orca class",
);
check(
  FOLDING_HANDLE_SELECTOR === ".orca-block-folding-handle",
  "FOLDING_HANDLE_SELECTOR matches host Orca selector",
);

// 2. isBlockFolded predicate
check(
  isBlockFolded({
    properties: [{ name: "_repr", value: { type: "text", fold: true } }],
  }) === true,
  "fold: true returns true",
);
check(
  isBlockFolded({
    properties: [{ name: "_repr", value: { type: "text", fold: false } }],
  }) === false,
  "fold: false returns false",
);
check(
  isBlockFolded({
    properties: [{ name: "_repr", value: { type: "text" } }],
  }) === false,
  "missing fold field returns false",
);
check(
  isBlockFolded({
    properties: [],
  }) === false,
  "missing _repr property returns false",
);
check(isBlockFolded(null) === false, "null block returns false");
check(isBlockFolded(undefined) === false, "undefined block returns false");

// 3. Intermediate node folded -> node in results, its descendants are NOT in results
const treeWithFoldedChild: CardTreeLookup = {
  1: { children: [2, 3] },
  2: {
    children: [4, 5],
    properties: [{ name: "_repr", value: { type: "text", fold: true } }],
  },
  3: { children: [6] },
  4: { children: [] },
  5: { children: [] },
  6: { children: [] },
};

const plan1 = planCardBlockTree(1, treeWithFoldedChild);
check(
  plan1.map((n) => `${n.id}@${n.depth}`).join(",") === "1@0,2@1,3@1,6@2",
  "folded intermediate node (2) is kept, but descendants (4, 5) are excluded; unfolded sibling (3) lists (6)",
);

// 4. Node fold is false / missing / _repr absent -> descendants expand normally
const treeWithUnfolded: CardTreeLookup = {
  1: { children: [2, 3] },
  2: {
    children: [4],
    properties: [{ name: "_repr", value: { type: "text", fold: false } }],
  },
  3: {
    children: [5],
  },
  4: { children: [] },
  5: { children: [] },
};

const plan2 = planCardBlockTree(1, treeWithUnfolded);
check(
  plan2.map((n) => `${n.id}@${n.depth}`).join(",") === "1@0,2@1,4@2,3@1,5@2",
  "unfolded nodes with fold: false or missing _repr walk all descendants",
);

// 5. Root node fold === true -> result has only the root node
const treeWithFoldedRoot: CardTreeLookup = {
  1: {
    children: [2, 3],
    properties: [{ name: "_repr", value: { type: "text", fold: true } }],
  },
  2: { children: [4] },
  3: { children: [] },
  4: { children: [] },
};

const planRootFolded = planCardBlockTree(1, treeWithFoldedRoot);
check(
  planRootFolded.length === 1 &&
    planRootFolded[0].id === 1 &&
    planRootFolded[0].depth === 0,
  "folded root node yields only the root node itself",
);

// 6. Combination: folded node + promoted
const treeWithPromoted: CardTreeLookup = {
  1: { children: [2, 3] },
  2: {
    children: [4],
    properties: [{ name: "_repr", value: { type: "text", fold: true } }],
  },
  3: { children: [5] },
  4: { children: [] },
  5: { children: [] },
};

// 6.1 If a promoted id is a child of a folded node, the parent's fold prevents walking into it
const planPromotedUnderFolded = planCardBlockTree(
  1,
  treeWithPromoted,
  4,
  80,
  new Set([4]),
);
check(
  planPromotedUnderFolded.map((n) => n.id).join(",") === "1,2,3,5",
  "child 4 is under folded 2 so it is not visited even though promoted",
);

// 6.2 Promoted sibling of a folded node
const planPromotedSibling = planCardBlockTree(
  1,
  treeWithPromoted,
  4,
  80,
  new Set([3]),
);
check(
  planPromotedSibling
    .map((n) => `${n.id}@${n.depth}${n.promoted ? "p" : ""}`)
    .join(",") === "1@0,2@1,3@1p",
  "promoted sibling 3 becomes a placeholder; folded sibling 2 stops at itself",
);

// 7. Combination: folded node + hostOwn (types like quote2, table2, whiteboard)
const treeWithHostOwn: CardTreeLookup = {
  1: { children: [2, 3] },
  2: {
    children: [4],
    properties: [{ name: "_repr", value: { type: "table2", fold: true } }],
  },
  3: {
    children: [5],
    properties: [{ name: "_repr", value: { type: "quote2" } }],
  },
  4: { children: [] },
  5: { children: [] },
};

const planHostOwn = planCardBlockTree(1, treeWithHostOwn);
check(
  planHostOwn
    .map((n) => `${n.id}@${n.depth}${n.hostOwn ? "h" : ""}`)
    .join(",") === "1@0,2@1h,3@1h",
  "hostOwn types do not walk children whether fold is true or false",
);

// 8. Combination: folded node + maxDepth
const deepTree: CardTreeLookup = {
  1: { children: [2, 3] },
  2: {
    children: [4],
    properties: [{ name: "_repr", value: { type: "text", fold: true } }],
  },
  3: { children: [5] },
  4: { children: [6] },
  5: { children: [7] },
  6: { children: [] },
  7: { children: [8] },
  8: { children: [] },
};

const planMaxDepth = planCardBlockTree(1, deepTree, 2, 80);
check(
  planMaxDepth.map((n) => `${n.id}@${n.depth}`).join(",") ===
    "1@0,2@1,3@1,5@2",
  "maxDepth 2 cuts deep unfolded branch at depth 2; folded branch stops earlier at depth 1",
);

// 9. Combination: folded node + maxNodes
const planMaxNodes = planCardBlockTree(1, deepTree, 4, 3);
check(
  planMaxNodes.map((n) => n.id).join(",") === "1,2,3",
  "maxNodes cap (3) is respected with folded node present",
);

// 10. cardTreePlanEqual
check(
  cardTreePlanEqual(
    [{ id: 1, depth: 0, hostOwn: false, promoted: false }],
    [{ id: 1, depth: 0, hostOwn: false, promoted: false }],
  ) === true,
  "identical plans are equal",
);
check(
  cardTreePlanEqual(
    [{ id: 1, depth: 0, hostOwn: false, promoted: false }],
    [{ id: 1, depth: 0, hostOwn: false, promoted: false }, { id: 2, depth: 1, hostOwn: false, promoted: false }],
  ) === false,
  "different lengths are not equal",
);
check(
  cardTreePlanEqual(
    [{ id: 1, depth: 0, hostOwn: false, promoted: false }],
    [{ id: 1, depth: 0, hostOwn: true, promoted: false }],
  ) === false,
  "different hostOwn is not equal",
);
check(
  cardTreePlanEqual(
    [{ id: 1, depth: 0, hostOwn: false, promoted: false }],
    [{ id: 1, depth: 0, hostOwn: false, promoted: true }],
  ) === false,
  "different promoted is not equal",
);

console.log("cardTreePlan.test.ts ok");
