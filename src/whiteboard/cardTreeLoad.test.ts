import {
  CARD_TREE_LOAD_MAX_DEPTH,
  CARD_TREE_LOAD_MAX_NODES,
  cardRootsWithHoles,
  cardTreeLoadIds,
  collectMissingCardTreeIds,
} from "./cardTreeLoad.ts";

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

console.log("cardTreeLoad.test.ts ok");
