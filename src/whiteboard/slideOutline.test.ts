import { type WhiteboardArea } from "./areas.ts";
import { slideOutlineRows } from "./slideOutline.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function makeArea(
  id: string,
  name: string,
  box: { x: number; y: number; w: number; h: number },
  slide?: number,
  collapsed?: true,
): WhiteboardArea {
  const area: WhiteboardArea = {
    id,
    name,
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
  };
  if (slide != null) area.slide = slide;
  if (collapsed) area.collapsed = true;
  return area;
}

// 1. Empty sequence returns empty array
const emptyRows = slideOutlineRows([], []);
check(emptyRows.length === 0, "empty areas returns empty rows");

// 2. Only lists areas with slide defined
const mixedAreas: WhiteboardArea[] = [
  makeArea("a1", "Section 1", { x: 0, y: 0, w: 200, h: 200 }, 2),
  makeArea("a2", "Non-slide", { x: 300, y: 0, w: 200, h: 200 }),
  makeArea("a3", "Section 0", { x: 600, y: 0, w: 200, h: 200 }, 1),
  makeArea("a4", "", { x: 900, y: 0, w: 200, h: 200 }, 3, true),
];

const cards = [
  // In a1 (0, 0, 200, 200)
  { x: 10, y: 10, w: 50, h: 50 },
  { x: 70, y: 70, w: 50, h: 50 },
  // Straddling a1 boundary (outside)
  { x: 180, y: 180, w: 50, h: 50 },
  // In a3 (600, 0, 200, 200)
  { x: 610, y: 10, w: 50, h: 50 },
  // In a4 (collapsed section, 900, 0, 200, 200)
  { x: 910, y: 10, w: 50, h: 50 },
  { x: 920, y: 20, w: 50, h: 50 },
  { x: 930, y: 30, w: 50, h: 50 },
  // Far outside all areas
  { x: 2000, y: 2000, w: 50, h: 50 },
];

const rows = slideOutlineRows(mixedAreas, cards);

check(rows.length === 3, "filters out non-slide areas (3 slide rows)");

// Check order & numbering (a3 was slide 1, a1 was slide 2, a4 was slide 3)
check(rows[0].areaId === "a3", "first row is a3");
check(rows[0].index === 0, "first row index is 0");
check(rows[0].number === 1, "first row number is 1");
check(rows[0].name === "Section 0", "first row name is Section 0");
check(rows[0].cardCount === 1, "first row cardCount is 1");

check(rows[1].areaId === "a1", "second row is a1");
check(rows[1].index === 1, "second row index is 1");
check(rows[1].number === 2, "second row number is 2");
check(rows[1].name === "Section 1", "second row name is Section 1");
check(rows[1].cardCount === 2, "second row cardCount is 2 (straddling card ignored)");

check(rows[2].areaId === "a4", "third row is a4");
check(rows[2].index === 2, "third row index is 2");
check(rows[2].number === 3, "third row number is 3");
check(rows[2].name === "", "third row preserves empty name");
check(rows[2].cardCount === 3, "collapsed area still counts contained cards");

console.log("slideOutline.test.ts ok");
