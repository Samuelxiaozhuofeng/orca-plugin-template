import { nestWouldCycle } from "./boardNestCycle.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

/** C has A and B; A already contains B. Dropping A onto B cycles. */
const tree = new Map<number, number[]>([
  [1, [900]],
  [900, []],
  [2, []],
]);

const childrenOf = (id: number) => tree.get(id) ?? [];

check(
  nestWouldCycle({
    movingIds: [1],
    targetBoardId: 900,
    childrenOf,
  }),
  "A contains B → drop A onto B is a cycle",
);

check(
  !nestWouldCycle({
    movingIds: [2],
    targetBoardId: 900,
    childrenOf,
  }),
  "a regular card onto B is fine",
);

check(
  !nestWouldCycle({
    movingIds: [900],
    targetBoardId: 1,
    childrenOf,
  }),
  "B onto A is just nesting, not a cycle",
);

const loop = new Map<number, number[]>([
  [1, [2]],
  [2, [1]],
]);
check(
  nestWouldCycle({
    movingIds: [1],
    targetBoardId: 3,
    childrenOf: (id) => loop.get(id) ?? [],
  }) === false,
  "existing A↔B cycle does not claim a drop onto C",
);

const deep: number[][] = [];
for (let i = 0; i < 12; i++) deep[i] = i === 11 ? [99] : [i + 1];
check(
  !nestWouldCycle({
    movingIds: [0],
    targetBoardId: 99,
    childrenOf: (id) => (typeof id === "number" && id >= 0 && id < 12 ? deep[id] : []),
    maxDepth: 8,
  }),
  "depth cap stops a 12-hop walk",
);

console.log("boardNestCycle tests passed");
