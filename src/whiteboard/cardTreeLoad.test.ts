import {
  CARD_TREE_LOAD_MAX_DEPTH,
  CARD_TREE_LOAD_MAX_NODES,
  cardRootsWithHoles,
  cardTreeLoadIds,
  collectMissingCardTreeIds,
  planCardTreeQueue,
  planGetBlocksBatches,
} from "./cardTreeLoad.ts";
import { GET_BLOCKS_BATCH_SIZE, isWhiteboardBlock } from "./pageBoardPlan.ts";
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
  cardTreeLoadIds([{ blockId: 1 }, { blockId: 2 }]).join(",") === "1,2",
  "visible cards load their trees when not simplified",
);
check(
  cardTreeLoadIds([{ blockId: 1 }, { blockId: 2 }], {
    simplified: true,
  }).join(",") === "",
  "simplified cards do not load trees",
);
check(
  cardTreeLoadIds([{ blockId: 1 }, { blockId: 2 }], {
    simplified: true,
    keep: 2,
  }).join(",") === "2",
  "editing card still loads while others are simplified",
);

// skip: only drop roots already loaded *and* confirmed as whiteboards.
const skipBlocks: Record<
  number,
  { properties?: { name: string; value?: unknown }[] } | undefined
> = {
  10: {
    properties: [{ name: "_repr", value: { type: "whiteboard.canvas" } }],
  },
  11: { properties: [{ name: "_repr", value: { type: "text" } }] },
  // 12 is absent — block not loaded yet
};
const skipLoadedWhiteboard = (id: number) => isWhiteboardBlock(skipBlocks[id]);

check(
  cardTreeLoadIds([{ blockId: 10 }], { skip: skipLoadedWhiteboard }).join(
    ",",
  ) === "",
  "loaded whiteboard root is skipped",
);
check(
  cardTreeLoadIds([{ blockId: 11 }], { skip: skipLoadedWhiteboard }).join(
    ",",
  ) === "11",
  "loaded non-whiteboard root is not skipped",
);
check(
  cardTreeLoadIds([{ blockId: 12 }], { skip: skipLoadedWhiteboard }).join(
    ",",
  ) === "12",
  "unloaded root is not skipped",
);
check(
  cardTreeLoadIds(
    [{ blockId: 10 }, { blockId: 11 }, { blockId: 12 }],
    { skip: skipLoadedWhiteboard },
  ).join(",") === "11,12",
  "skip drops only loaded whiteboard roots from a mixed list",
);
check(
  cardTreeLoadIds(
    [{ blockId: 10 }, { blockId: 11 }],
    { simplified: true, keep: 11, skip: skipLoadedWhiteboard },
  ).join(",") === "11",
  "simplified keep still loads the editing non-whiteboard card",
);
check(
  cardTreeLoadIds(
    [{ blockId: 10 }, { blockId: 11 }],
    { simplified: true, keep: 10 },
  ).join(",") === "10",
  "simplified keep without skip is unchanged",
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
check(
  planCardBlockTree(
    1,
    {
      1: { children: [2, 3] },
      2: { children: [4] },
      3: { children: [] },
      4: { children: [] },
    },
    4,
    80,
    new Set([2]),
  )
    .map((node) => `${node.id}${node.promoted ? "p" : ""}`)
    .join(",") === "1,2p,3",
  "plan keeps a promoted node without its subtree",
);

const loadedTree = {
  1: { children: [2] },
  2: { children: [] },
};
check(
  planCardTreeQueue([{ blockId: 1 }], loadedTree).queue.join(",") === "",
  "successful tree is not requeued",
);
check(
  planCardTreeQueue([{ blockId: 1 }], loadedTree).failedRoots.join(",") === "",
  "successful tree is not a load failure",
);

const holeAtChild = { 1: { children: [2] } };
const childRetry = planCardTreeQueue([{ blockId: 1 }], holeAtChild, {
  retryable: new Set([2]),
});
check(childRetry.queue.join(",") === "", "failed id is not auto-requeued");
check(childRetry.failedRoots.join(",") === "1", "failed child marks the card");
check(childRetry.notices[0]?.scope === "partial", "root present is partial failure");
check(childRetry.notices[0]?.cause === "retryable", "throw is retryable");
check(
  planCardTreeQueue([{ blockId: 1 }], holeAtChild, {
    retryable: new Set([2]),
    retry: new Set([2]),
  }).queue.join(",") === "2",
  "retry requeues the failed id",
);

const emptyRetry = planCardTreeQueue([{ blockId: 1 }], {}, {
  retryable: new Set([1]),
});
check(emptyRetry.notices[0]?.scope === "empty", "missing root is whole-card failure");
check(emptyRetry.notices[0]?.cause === "retryable", "missing root throw is retryable");

const childGone = planCardTreeQueue([{ blockId: 1 }], holeAtChild, {
  gone: new Set([2]),
});
check(childGone.queue.join(",") === "", "gone id is not queued");
check(childGone.notices[0]?.scope === "partial", "gone child is partial");
check(childGone.notices[0]?.cause === "gone", "backend miss is not retryable");
check(
  planCardTreeQueue([{ blockId: 1 }], holeAtChild, {
    gone: new Set([2]),
    retry: new Set([2]),
  }).queue.join(",") === "",
  "retry does not requeue a gone id",
);

const emptyGone = planCardTreeQueue([{ blockId: 1 }], {}, {
  gone: new Set([1]),
});
check(emptyGone.notices[0]?.scope === "empty", "gone root is whole-card failure");
check(emptyGone.notices[0]?.cause === "gone", "gone root is not retryable");

check(
  planCardTreeQueue([{ blockId: 1 }], { 1: { children: [] } }, {
    gone: new Set([1]),
  }).notices.length === 0,
  "a block that later appears is no longer gone",
);

const mixed = planCardTreeQueue(
  [{ blockId: 1 }],
  { 1: { children: [2, 3] } },
  { retryable: new Set([2]), gone: new Set([3]) },
);
check(mixed.notices[0]?.scope === "partial", "mixed holes stay partial");
check(mixed.notices[0]?.cause === "retryable", "retryable wins over gone");

check(
  planCardTreeQueue([{ blockId: 1 }], {}, {
    retryable: new Set([1]),
    simplified: true,
  }).queue.join(",") === "",
  "simplified lod does not queue a tree load",
);
check(
  planCardTreeQueue([{ blockId: 1 }], {}, {
    retryable: new Set([1]),
    simplified: true,
  }).failedRoots.join(",") === "",
  "simplified lod does not report load failure",
);

const fiveHundred = Array.from({ length: 500 }, (_, i) => i + 1);
const batches = planGetBlocksBatches(fiveHundred);
check(GET_BLOCKS_BATCH_SIZE === 200, "get-blocks batch size is 200");
check(batches.length === 3, "500 ids split into 3 get-blocks calls");
check(batches[0].length === 200 && batches[1].length === 200, "full batches are 200");
check(batches[2].length === 100, "remainder is its own batch");
check(
  planGetBlocksBatches([]).length === 0,
  "empty id list does not emit a get-blocks call",
);

console.log("cardTreeLoad.test.ts ok");
