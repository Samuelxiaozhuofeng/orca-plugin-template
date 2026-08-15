import {
  AREA_PAD,
  AREA_TITLE_H,
  cardInArea,
  planAreaFromCards,
  planAreaMove,
  planWrapAreaFromCards,
  removeArea,
  type WhiteboardArea,
} from "./areas.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function card(x: number, y: number, w = 100, h = 80) {
  return { x, y, w, h };
}

const a = card(40, 60, 120, 80);
const b = card(200, 100, 80, 40);
const planned = planAreaFromCards([a, b]);
check(planned != null, "selection yields an area");
if (planned != null) {
  check(planned.x === 40 - AREA_PAD, "left pad");
  check(planned.y === 60 - AREA_PAD - AREA_TITLE_H, "top pad includes title");
  check(planned.w === 200 + 80 - 40 + AREA_PAD * 2, "width covers both plus pad");
  check(
    planned.h === 100 + 40 - 60 + AREA_PAD * 2 + AREA_TITLE_H,
    "height covers both plus pad and title",
  );
  check(cardInArea(a, planned), "first card is inside the planned area");
  check(cardInArea(b, planned), "second card is inside the planned area");
}

check(planAreaFromCards([]) == null, "no selection yields no area");
check(planWrapAreaFromCards([]) == null, "wrap of 0 cards yields no area");
check(planWrapAreaFromCards([a]) == null, "wrap of 1 card yields no area");
check(planWrapAreaFromCards([a, b]) != null, "wrap of 2 cards yields an area");

const frame: WhiteboardArea = {
  id: "area-1",
  name: "S",
  x: 0,
  y: 0,
  w: 200,
  h: 200,
};
check(cardInArea(card(10, 10, 50, 50), frame), "fully inside is inside");
check(cardInArea(card(0, 0, 200, 200), frame), "flush against the border is inside");
check(!cardInArea(card(300, 300, 50, 50), frame), "fully outside is outside");
check(
  !cardInArea(card(150, 150, 80, 80), frame),
  "straddling the border is outside",
);
check(
  !cardInArea(card(-10, 10, 50, 50), frame),
  "overhanging the left edge is outside",
);

const cards = [
  { blockId: 1, kind: "block" as const, x: 10, y: 10, w: 40, h: 40 },
  { blockId: 2, kind: "block" as const, x: 80, y: 10, w: 40, h: 40 },
];
const before = cards.map((item) => ({ ...item }));
const areas: WhiteboardArea[] = [frame, { ...frame, id: "area-2", x: 400 }];
const next = removeArea(areas, "area-1");
check(next.length === 1 && next[0].id === "area-2", "delete drops only that area");
check(
  JSON.stringify(cards) === JSON.stringify(before),
  "delete area does not mutate cards",
);

const inside = { blockId: 1, kind: "block" as const, x: 10, y: 10, w: 40, h: 40 };
const outside = { blockId: 2, kind: "block" as const, x: 300, y: 300, w: 40, h: 40 };
const moved = planAreaMove(frame, 50, 20, [inside, outside], [frame]);
check(moved.areas[0].x === 50 && moved.areas[0].y === 20, "area shifts by dx,dy");
check(moved.cards[0].x === 60 && moved.cards[0].y === 30, "inside card follows");
check(
  moved.cards[1].x === 300 && moved.cards[1].y === 300,
  "outside card stays put",
);

const flush = card(0, 0, 200, 200);
const flushMove = planAreaMove(frame, 10, 0, [flush], [frame]);
check(flushMove.cards[0].x === 10, "flush-against-border card follows");

const straddle = card(150, 150, 80, 80);
const straddleMove = planAreaMove(frame, 10, 0, [straddle], [frame]);
check(straddleMove.cards[0].x === 150, "straddling card does not follow");

const emptyCards = [outside];
const emptyMove = planAreaMove(frame, 8, 8, emptyCards, [frame]);
check(emptyMove.areas[0].x === 8 && emptyMove.areas[0].y === 8, "empty area moves");
check(emptyMove.cards === emptyCards, "empty area returns the same cards array");

const overlap: WhiteboardArea = { ...frame, id: "area-2", x: 20, y: 20 };
const shared = { blockId: 5, kind: "block" as const, x: 30, y: 30, w: 40, h: 40 };
const overlapMove = planAreaMove(frame, 12, 0, [shared], [frame, overlap]);
check(overlapMove.cards[0].x === 42, "card in both areas follows the dragged one");
check(overlapMove.areas[1].x === 20, "the other overlapping area stays put");

console.log("areaPlan.test.ts ok");
