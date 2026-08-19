import {
  CARD_HEADER_HEIGHT_EST,
  CARD_NODE_BUDGET_MIN,
  CARD_NODE_BUDGET_STEP,
  CARD_ROW_HEIGHT_EST,
  CARD_ROW_PREFETCH,
  cardRenderNodeBudget,
} from "./cardNodeBudget.ts";
import { CARD_TREE_LOAD_MAX_NODES } from "./cardTreeQueue.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

// 1. Constants sanity check
check(CARD_ROW_HEIGHT_EST === 28, "CARD_ROW_HEIGHT_EST is 28");
check(CARD_HEADER_HEIGHT_EST === 44, "CARD_HEADER_HEIGHT_EST is 44");
check(CARD_ROW_PREFETCH === 6, "CARD_ROW_PREFETCH is 6");
check(CARD_NODE_BUDGET_MIN === 12, "CARD_NODE_BUDGET_MIN is 12");
check(CARD_NODE_BUDGET_STEP === 16, "CARD_NODE_BUDGET_STEP is 16");

// 2. Default 200px card with grown=0
const b200 = cardRenderNodeBudget(200);
check(
  b200 === CARD_NODE_BUDGET_MIN,
  `200px card renders CARD_NODE_BUDGET_MIN (${CARD_NODE_BUDGET_MIN}), got ${b200}`,
);
check(
  b200 < CARD_TREE_LOAD_MAX_NODES,
  `200px card budget (${b200}) is strictly less than max (${CARD_TREE_LOAD_MAX_NODES})`,
);

// 3. Tall card (e.g. 3000px) clamped to max
const b3000 = cardRenderNodeBudget(3000);
check(
  b3000 === CARD_TREE_LOAD_MAX_NODES,
  `3000px card is clamped to CARD_TREE_LOAD_MAX_NODES (${CARD_TREE_LOAD_MAX_NODES}), got ${b3000}`,
);

// 4. Height monotonicity
let prevBudget = cardRenderNodeBudget(1);
for (let h = 2; h <= 4000; h += 25) {
  const b = cardRenderNodeBudget(h);
  check(
    b >= prevBudget,
    `Budget should be monotonic with height: at h=${h} (${b}) < at h-25 (${prevBudget})`,
  );
  check(
    b >= CARD_NODE_BUDGET_MIN && b <= CARD_TREE_LOAD_MAX_NODES,
    `Budget at h=${h} (${b}) should be within [${CARD_NODE_BUDGET_MIN}, ${CARD_TREE_LOAD_MAX_NODES}]`,
  );
  prevBudget = b;
}

// 5. Grown monotonicity and upper bound
let prevGrownBudget = cardRenderNodeBudget(200, 0);
for (let g = 1; g <= 200; g += 5) {
  const b = cardRenderNodeBudget(200, g);
  check(
    b >= prevGrownBudget,
    `Budget should be monotonic with grown: at g=${g} (${b}) < previous (${prevGrownBudget})`,
  );
  check(
    b <= CARD_TREE_LOAD_MAX_NODES,
    `Budget with grown=${g} (${b}) should not exceed CARD_TREE_LOAD_MAX_NODES`,
  );
  prevGrownBudget = b;
}
check(
  cardRenderNodeBudget(200, 1000) === CARD_TREE_LOAD_MAX_NODES,
  "Large grown is clamped to CARD_TREE_LOAD_MAX_NODES",
);

// 6. Invalid / zero / negative cardHeight -> CARD_TREE_LOAD_MAX_NODES
check(
  cardRenderNodeBudget(0) === CARD_TREE_LOAD_MAX_NODES,
  "cardHeight=0 returns CARD_TREE_LOAD_MAX_NODES",
);
check(
  cardRenderNodeBudget(-100) === CARD_TREE_LOAD_MAX_NODES,
  "cardHeight=-100 returns CARD_TREE_LOAD_MAX_NODES",
);
check(
  cardRenderNodeBudget(NaN) === CARD_TREE_LOAD_MAX_NODES,
  "cardHeight=NaN returns CARD_TREE_LOAD_MAX_NODES",
);
check(
  cardRenderNodeBudget(Infinity) === CARD_TREE_LOAD_MAX_NODES,
  "cardHeight=Infinity returns CARD_TREE_LOAD_MAX_NODES",
);
check(
  cardRenderNodeBudget(-Infinity) === CARD_TREE_LOAD_MAX_NODES,
  "cardHeight=-Infinity returns CARD_TREE_LOAD_MAX_NODES",
);

// 7. Invalid / negative grown -> treated as 0
check(
  cardRenderNodeBudget(200, -10) === cardRenderNodeBudget(200, 0),
  "grown=-10 gives same result as grown=0",
);
check(
  cardRenderNodeBudget(200, -Infinity) === cardRenderNodeBudget(200, 0),
  "grown=-Infinity gives same result as grown=0",
);
check(
  cardRenderNodeBudget(200, NaN) === cardRenderNodeBudget(200, 0),
  "grown=NaN gives same result as grown=0",
);
check(
  cardRenderNodeBudget(500, -5) === cardRenderNodeBudget(500, 0),
  "grown=-5 with 500px card gives same result as grown=0",
);

console.log("cardNodeBudget.test.ts ok");
