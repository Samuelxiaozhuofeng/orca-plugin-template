import {
  CARD_TREE_LOAD_MAX_DEPTH,
  CARD_TREE_LOAD_MAX_NODES,
  cardRootsWithHoles,
  cardTreeLoadIds,
  collectMissingCardTreeIds,
} from "./cardTreeLoad.ts";
import {
  hostDrawsOwnChildren,
  isBlockFolded,
  planCardBlockTree,
} from "./cardTreePlan.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const blocks = {
  1: { children: [2, 3] },
  2: { children: [4] },
  3: { children: [] },
};

check(
  collectMissingCardTreeIds([1], blocks).join(",") === "4",
  "missing grandchild",
);
check(
  collectMissingCardTreeIds([1], { 1: { children: [2] } }).join(",") === "2",
  "missing child",
);
check(
  collectMissingCardTreeIds([10], {}).join(",") === "10",
  "missing root",
);
check(
  collectMissingCardTreeIds([1], {
    1: { children: [2] },
    2: { children: [] },
  }).length === 0,
  "complete tree",
);
check(
  collectMissingCardTreeIds([1], { 1: { children: [2] } }, 0, 80).join(",") ===
    "",
  "depth 0 does not look at children",
);
check(
  cardRootsWithHoles([1, 9], {
    1: { children: [] },
  }).join(",") === "9",
  "only incomplete roots",
);
check(
  cardTreeLoadIds([{ blockId: 1 }, { blockId: 2 }], false, null).join(",") ===
    "1,2",
  "full zoom loads visible cards",
);
check(
  cardTreeLoadIds([{ blockId: 1 }], true, null).length === 0,
  "excerpt zoom loads none",
);
check(
  cardTreeLoadIds([{ blockId: 1 }, { blockId: 2 }], true, 2).join(",") === "2",
  "excerpt zoom still loads the card being edited",
);
check(CARD_TREE_LOAD_MAX_DEPTH === 4, "depth cap");
check(CARD_TREE_LOAD_MAX_NODES === 80, "node cap");

const foldedParent = {
  children: [2],
  properties: [{ name: "_repr", value: { type: "text", fold: true } }],
};
check(isBlockFolded(foldedParent) === true, "fold reads _repr.fold");
check(isBlockFolded({ children: [2] }) === false, "missing _repr is open");
check(
  collectMissingCardTreeIds([1], {
    1: foldedParent,
  }).join(",") === "2",
  "folded parent still requests children",
);
check(
  planCardBlockTree(1, {
    1: foldedParent,
    2: { children: [3] },
    3: { children: [] },
  })
    .map((node) => `${node.id}@${node.depth}`)
    .join(",") === "1@0,2@1,3@2",
  "plan lists children of a folded parent",
);
check(
  hostDrawsOwnChildren({
    children: [9],
    properties: [{ name: "_repr", value: { type: "table2" } }],
  }) === true,
  "table2 draws its own children",
);
check(
  planCardBlockTree(1, {
    1: {
      children: [2],
      properties: [{ name: "_repr", value: { type: "table2", fold: true } }],
    },
    2: { children: [] },
  })
    .map((node) => node.id)
    .join(",") === "1",
  "do not flatten table2 cells",
);
check(
  planCardBlockTree(1, { 1: { children: [2] } }, 0, 80).map((node) => node.id)
    .join(",") === "1",
  "plan depth 0 is root only",
);
check(
  planCardBlockTree(
    1,
    {
      1: { children: [2, 3] },
      2: { children: [] },
      3: { children: [] },
    },
    4,
    2,
  )
    .map((node) => node.id)
    .join(",") === "1,2",
  "plan node cap",
);

console.log("cardTreeLoad.test.ts ok");
