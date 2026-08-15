import {
  AREA_PAD,
  AREA_TITLE_H,
  cardInArea,
  planAreaFromCards,
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

console.log("areaPlan.test.ts ok");
