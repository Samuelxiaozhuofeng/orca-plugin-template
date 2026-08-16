import {
  planDropOntoBoard,
  type DropOntoBoardPlan,
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

const A = 1;
const B = 900;

function mustPlan(
  cards: WhiteboardCard[],
  edges: WhiteboardEdge[],
  moving: number[],
  target = B,
  current = A,
  origin?: { x: number; y: number },
): DropOntoBoardPlan {
  const plan = planDropOntoBoard({
    cards,
    edges,
    movingIds: new Set(moving),
    targetBoardId: target,
    currentBoardId: current,
    origin,
  });
  check(plan != null, "expected a drop plan");
  return plan as DropOntoBoardPlan;
}

const one = mustPlan([card(10, { x: 80, y: 40 }), card(B, { x: 400, y: 40 })], [], [10]);
check(one.movedCards.length === 1, "a single card can move");
check(one.movedCards[0].blockId === 10, "the one card is the payload");
check(one.movedCards[0].x === GRID_ORIGIN, "single card lands on origin x");
check(one.movedCards[0].y === GRID_ORIGIN, "single card lands on origin y");
check(
  one.leftoverCards.length === 1 && one.leftoverCards[0].blockId === B,
  "the target board card stays on A",
);

const withTarget = mustPlan(
  [card(10, { x: 0, y: 0 }), card(B, { x: 200, y: 0 }), card(11, { x: 80, y: 40 })],
  [],
  [10, B, 11],
);
check(
  withTarget.movedCards.every((item) => item.blockId !== B),
  "target board card is excluded from the payload",
);
check(withTarget.movedCards.length === 2, "the other selected cards still move");
check(
  withTarget.leftoverCards.some((item) => item.blockId === B),
  "target board card remains on A",
);

check(
  planDropOntoBoard({
    cards: [card(B, { x: 0, y: 0 })],
    edges: [],
    movingIds: new Set([B]),
    targetBoardId: B,
    currentBoardId: A,
  }) == null,
  "only the target card → nothing to move",
);

check(
  planDropOntoBoard({
    cards: [card(10), card(B)],
    edges: [],
    movingIds: new Set([10]),
    targetBoardId: A,
    currentBoardId: A,
  }) == null,
  "dropping onto A itself is refused",
);

const bothEnds = mustPlan(
  [card(10, { x: 100, y: 100 }), card(11, { x: 200, y: 100 }), card(B, { x: 400, y: 100 })],
  [edge(10, 11, { label: "inside" }), edge(10, 12), edge(20, 21)],
  [10, 11],
);
check(
  bothEnds.movedEdges.length === 1 &&
    bothEnds.movedEdges[0].from === 10 &&
    bothEnds.movedEdges[0].to === 11,
  "both-ends-selected edge moves to B",
);
check(bothEnds.movedEdges[0].label === "inside", "moved edge keeps label");

const remapped = mustPlan(
  [card(10, { x: 0, y: 0 }), card(11, { x: 80, y: 0 }), card(B, { x: 400, y: 0 })],
  [
    edge(10, 12, {
      linked: true,
      bend: { from: { along: 1, across: 0.2 }, to: { along: 1, across: -0.1 } },
      arrow: "both",
      color: "blue",
      style: "dashed",
    }),
  ],
  [10],
);
check(remapped.leftoverEdges.length === 1, "one remapped edge stays on A");
check(remapped.leftoverEdges[0].from === B, "selected end remaps to the board card");
check(remapped.leftoverEdges[0].to === 12, "unselected end stays");
check(remapped.leftoverEdges[0].linked == null, "remapped edge drops linked");
check(remapped.leftoverEdges[0].bend == null, "remapped edge drops bend");
check(remapped.leftoverEdges[0].arrow === "both", "remapped edge keeps arrow");
check(remapped.leftoverEdges[0].color === "blue", "remapped edge keeps color");
check(remapped.leftoverEdges[0].style === "dashed", "remapped edge keeps style");

const untouched = mustPlan(
  [card(10, { x: 0, y: 0 }), card(11, { x: 80, y: 0 }), card(12, { x: 400, y: 0 })],
  [edge(11, 12, { color: "green", linked: true })],
  [10],
);
check(untouched.leftoverEdges.length === 1, "untouched edge stays on A");
check(
  untouched.leftoverEdges[0].from === 11 && untouched.leftoverEdges[0].to === 12,
  "untouched pair unchanged",
);
check(untouched.leftoverEdges[0].linked === true, "untouched linked flag kept");
check(untouched.leftoverEdges[0].color === "green", "untouched color kept");

const a = card(10, { x: 120, y: 80, color: "coral", hLock: true });
const bCard = card(11, { x: 300, y: 200 });
const c = card(12, { x: 180, y: 360, w: 200, h: 160 });
const relative = mustPlan([a, bCard, c, card(B, { x: 800, y: 0 })], [], [10, 11, 12]);
check(relative.movedCards.length === 3, "all three cards move to B");
const byId = new Map(relative.movedCards.map((item) => [item.blockId, item]));
const ma = byId.get(10);
const mb = byId.get(11);
const mc = byId.get(12);
check(ma != null && mb != null && mc != null, "moved cards keep ids");
check(ma != null && ma.x === GRID_ORIGIN, "bbox left lands on GRID_ORIGIN x");
check(ma != null && ma.y === GRID_ORIGIN, "bbox top lands on GRID_ORIGIN y");
check(
  ma != null &&
    mb != null &&
    mb.x - ma.x === bCard.x - a.x &&
    mb.y - ma.y === bCard.y - a.y,
  "A→B offset preserved",
);
check(
  ma != null &&
    mc != null &&
    mc.x - ma.x === c.x - a.x &&
    mc.y - ma.y === c.y - a.y,
  "A→C offset preserved",
);
check(ma != null && ma.color === "coral" && ma.hLock === true, "color and hLock travel");
check(mc != null && mc.w === 200 && mc.h === 160, "size travels with the card");

const customOrigin = mustPlan(
  [card(10, { x: 100, y: 50 }), card(11, { x: 180, y: 90 })],
  [],
  [10, 11],
  B,
  A,
  { x: 40, y: 80 },
);
const originById = new Map(customOrigin.movedCards.map((item) => [item.blockId, item]));
check(originById.get(10)?.x === 40 && originById.get(10)?.y === 80, "custom origin");
check(
  originById.get(11) != null &&
    originById.get(10) != null &&
    originById.get(11)!.x - originById.get(10)!.x === 80 &&
    originById.get(11)!.y - originById.get(10)!.y === 40,
  "custom origin keeps relative offset",
);

const dup = mustPlan(
  [card(10, { x: 0, y: 0 }), card(11, { x: 80, y: 0 }), card(12, { x: 400, y: 0 })],
  [edge(10, 12, { color: "blue" }), edge(11, 12, { color: "green" }), edge(8, 9)],
  [10, 11],
);
const remappedPairs = dup.leftoverEdges.filter(
  (item) => item.from === B || item.to === B,
);
check(remappedPairs.length === 1, "duplicate remapped pair is collapsed");
check(
  remappedPairs[0].from === B && remappedPairs[0].to === 12,
  "kept remapped pair is board card ↔ leftover",
);
check(remappedPairs[0].color === "blue", "sanitize keeps the first remapped edge");
check(
  dup.leftoverEdges.some((item) => item.from === 8 && item.to === 9),
  "untouched edge survives dedup",
);

const keptBend = mustPlan(
  [card(10, { x: 0, y: 0 }), card(11, { x: 80, y: 0 })],
  [
    edge(10, 11, {
      bend: { from: { along: 1.2, across: 0.4 }, to: { along: 0.8, across: -0.3 } },
    }),
  ],
  [10, 11],
);
check(keptBend.movedEdges[0].bend != null, "moved edge keeps relative bend");
check(
  keptBend.movedEdges[0].bend?.from.across === 0.4 &&
    keptBend.movedEdges[0].bend?.to.across === -0.3,
  "moved bend values are unchanged",
);
