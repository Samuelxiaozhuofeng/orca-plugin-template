import {
  planCollectIntoBoard,
  type CollectIntoBoardPlan,
} from "./collectIntoBoard.ts";
import type { WhiteboardCard } from "./cards.ts";
import type { WhiteboardEdge } from "./edges.ts";
import { CARD_HEIGHT, CARD_WIDTH, GRID_ORIGIN } from "./layout.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function card(
  id: number,
  extra: Partial<WhiteboardCard> = {},
): WhiteboardCard {
  return {
    blockId: id,
    kind: "block",
    x: 0,
    y: 0,
    w: CARD_WIDTH,
    h: CARD_HEIGHT,
    ...extra,
  };
}

function edge(
  from: number,
  to: number,
  extra: Partial<WhiteboardEdge> = {},
): WhiteboardEdge {
  return {
    id: `${from}-${to}-1`,
    from,
    to,
    arrow: "end",
    ...extra,
  };
}

const SUB = 900;

function mustPlan(
  cards: WhiteboardCard[],
  edges: WhiteboardEdge[],
  selected: number[],
  sub = SUB,
): CollectIntoBoardPlan {
  const plan = planCollectIntoBoard(cards, edges, new Set(selected), sub);
  check(plan != null, "expected a collect plan");
  return plan as CollectIntoBoardPlan;
}

const bothEnds = mustPlan(
  [card(1, { x: 100, y: 100 }), card(2, { x: 200, y: 100 }), card(3, { x: 400, y: 100 })],
  [edge(1, 2, { label: "inside" }), edge(1, 3), edge(4, 5)],
  [1, 2],
);
check(
  bothEnds.movedEdges.length === 1 && bothEnds.movedEdges[0].from === 1 && bothEnds.movedEdges[0].to === 2,
  "both-ends-selected edge moves to B",
);
check(bothEnds.movedEdges[0].label === "inside", "moved edge keeps label");

const remapped = mustPlan(
  [card(1, { x: 0, y: 0 }), card(2, { x: 80, y: 0 }), card(3, { x: 400, y: 0 })],
  [
    edge(1, 3, {
      linked: true,
      bend: { from: { along: 1, across: 0.2 }, to: { along: 1, across: -0.1 } },
      arrow: "both",
      color: "blue",
      style: "dashed",
    }),
  ],
  [1, 2],
);
check(remapped.leftoverEdges.length === 1, "one remapped edge stays on A");
check(remapped.leftoverEdges[0].from === SUB, "selected end remaps to the sub-board");
check(remapped.leftoverEdges[0].to === 3, "unselected end stays");
check(remapped.leftoverEdges[0].linked == null, "remapped edge drops linked");
check(remapped.leftoverEdges[0].bend == null, "remapped edge drops bend");
check(remapped.leftoverEdges[0].arrow === "both", "remapped edge keeps arrow");
check(remapped.leftoverEdges[0].color === "blue", "remapped edge keeps color");
check(remapped.leftoverEdges[0].style === "dashed", "remapped edge keeps style");

const untouched = mustPlan(
  [card(1, { x: 0, y: 0 }), card(2, { x: 80, y: 0 }), card(3, { x: 400, y: 0 }), card(4, { x: 600, y: 0 })],
  [edge(3, 4, { color: "green", linked: true })],
  [1, 2],
);
check(untouched.leftoverEdges.length === 1, "untouched edge stays on A");
check(untouched.leftoverEdges[0].from === 3 && untouched.leftoverEdges[0].to === 4, "untouched pair unchanged");
check(untouched.leftoverEdges[0].linked === true, "untouched linked flag kept");
check(untouched.leftoverEdges[0].color === "green", "untouched color kept");

const a = card(1, { x: 120, y: 80, color: "coral", hLock: true });
const b = card(2, { x: 300, y: 200 });
const c = card(3, { x: 180, y: 360, w: 200, h: 160 });
const relative = mustPlan([a, b, c], [], [1, 2, 3]);
check(relative.movedCards.length === 3, "all three cards move to B");
const byId = new Map(relative.movedCards.map((item) => [item.blockId, item]));
const ma = byId.get(1);
const mb = byId.get(2);
const mc = byId.get(3);
check(ma != null && mb != null && mc != null, "moved cards keep ids");
check(ma != null && ma.x === GRID_ORIGIN, "bbox left lands on GRID_ORIGIN x");
check(ma != null && ma.y === GRID_ORIGIN, "bbox top lands on GRID_ORIGIN y");
check(
  ma != null && mb != null && mb.x - ma.x === b.x - a.x && mb.y - ma.y === b.y - a.y,
  "A→B offset preserved",
);
check(
  ma != null && mc != null && mc.x - ma.x === c.x - a.x && mc.y - ma.y === c.y - a.y,
  "A→C offset preserved",
);
check(ma != null && ma.color === "coral" && ma.hLock === true, "color and hLock travel with the card");
check(mc != null && mc.w === 200 && mc.h === 160, "size travels with the card");

const placed = mustPlan(
  [card(1, { x: 100, y: 50, w: 100, h: 80 }), card(2, { x: 300, y: 250, w: 120, h: 60 })],
  [],
  [1, 2],
);
const boxLeft = 100;
const boxTop = 50;
const boxRight = 420;
const boxBottom = 310;
check(
  placed.subBoardCard.x === boxLeft + (boxRight - boxLeft) / 2 - CARD_WIDTH / 2,
  "sub-board card x is bbox center",
);
check(
  placed.subBoardCard.y === boxTop + (boxBottom - boxTop) / 2 - CARD_HEIGHT / 2,
  "sub-board card y is bbox center",
);
check(
  placed.subBoardCard.w === CARD_WIDTH && placed.subBoardCard.h === CARD_HEIGHT,
  "sub-board card uses default size",
);
check(placed.subBoardCard.blockId === SUB, "sub-board card points at the new board");
check(
  placed.leftoverCards.some((item) => item.blockId === SUB),
  "sub-board card is appended on A",
);
check(
  placed.leftoverCards.every((item) => item.blockId === SUB),
  "selected cards leave A",
);

check(
  planCollectIntoBoard([card(1), card(2)], [], new Set([1]), SUB) == null,
  "one selected card returns null",
);
check(
  planCollectIntoBoard([card(1), card(2)], [], new Set(), SUB) == null,
  "empty selection returns null",
);
check(
  planCollectIntoBoard([card(1)], [], new Set([1, 99]), SUB) == null,
  "only one matching card returns null",
);

const dup = mustPlan(
  [card(1, { x: 0, y: 0 }), card(2, { x: 80, y: 0 }), card(3, { x: 400, y: 0 })],
  [edge(1, 3, { color: "blue" }), edge(2, 3, { color: "green" }), edge(8, 9)],
  [1, 2],
);
const remappedPairs = dup.leftoverEdges.filter(
  (item) => item.from === SUB || item.to === SUB,
);
check(remappedPairs.length === 1, "duplicate remapped pair is collapsed");
check(
  remappedPairs[0].from === SUB && remappedPairs[0].to === 3,
  "kept remapped pair is sub-board ↔ leftover",
);
check(
  remappedPairs[0].color === "blue",
  "sanitize keeps the first remapped edge",
);
check(
  dup.leftoverEdges.some((item) => item.from === 8 && item.to === 9),
  "untouched edge survives dedup",
);

const keptBend = mustPlan(
  [card(1, { x: 0, y: 0 }), card(2, { x: 80, y: 0 })],
  [
    edge(1, 2, {
      bend: { from: { along: 1.2, across: 0.4 }, to: { along: 0.8, across: -0.3 } },
    }),
  ],
  [1, 2],
);
check(keptBend.movedEdges[0].bend != null, "moved edge keeps relative bend");
check(
  keptBend.movedEdges[0].bend?.from.across === 0.4 &&
    keptBend.movedEdges[0].bend?.to.across === -0.3,
  "moved bend values are unchanged",
);
