import { hitAreaAt, type WhiteboardArea } from "./areas.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function area(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): WhiteboardArea {
  return { id, x, y, w, h, name: id };
}

const outer = area("outer", 0, 0, 400, 300);
const inner = area("inner", 40, 40, 100, 80);
const other = area("other", 500, 0, 80, 80);
const twin = area("twin", 0, 0, 400, 300);

check(hitAreaAt(10, 10, []) == null, "empty list is a miss");
check(hitAreaAt(10, 10, [other]) == null, "point outside every area is a miss");
check(hitAreaAt(540, 40, [outer, other]) === "other", "lone containing area");
check(
  hitAreaAt(50, 50, [outer, inner, other]) === "inner",
  "nested point picks the smallest area",
);
check(
  hitAreaAt(10, 10, [outer, inner, other]) === "outer",
  "point only in the large area picks the large one",
);
check(hitAreaAt(0, 0, [outer]) === "outer", "top-left corner is inclusive");
check(hitAreaAt(400, 300, [outer]) === "outer", "bottom-right corner is inclusive");
check(hitAreaAt(400.1, 150, [outer]) == null, "just outside the right edge misses");
check(
  hitAreaAt(10, 10, [outer, twin]) === "twin",
  "equal-size overlap keeps the later area",
);
check(
  hitAreaAt(80, 60, [inner, outer]) === "inner",
  "smallest wins regardless of list order",
);

console.log("areaHit.test.ts ok");
