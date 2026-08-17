import { curveForBoxes, type CardBox } from "./edgeGeometry.ts";
import {
  measureCardRowBox,
  resolveSourceBox,
  RowBoxCache,
} from "./edgeRowBoxes.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const cardBox: CardBox = { x: 100, y: 200, w: 300, h: 400 };
const toBox: CardBox = { x: 600, y: 300, w: 200, h: 200 };

// 1. resolveSourceBox fallback / degrade tests
check(
  resolveSourceBox(cardBox, null) === cardBox,
  "null rowBox degrades to cardBox",
);
check(
  resolveSourceBox(cardBox, undefined) === cardBox,
  "undefined rowBox degrades to cardBox",
);
check(
  resolveSourceBox(cardBox, { x: NaN, y: 0, w: 100, h: 50 }) === cardBox,
  "NaN x degrades to cardBox",
);
check(
  resolveSourceBox(cardBox, { x: 100, y: NaN, w: 100, h: 50 }) === cardBox,
  "NaN y degrades to cardBox",
);
check(
  resolveSourceBox(cardBox, { x: 100, y: 200, w: 0, h: 50 }) === cardBox,
  "Zero width degrades to cardBox",
);
check(
  resolveSourceBox(cardBox, { x: 100, y: 200, w: 100, h: 0 }) === cardBox,
  "Zero height degrades to cardBox",
);
check(
  resolveSourceBox(cardBox, { x: 100, y: 200, w: -10, h: 50 }) === cardBox,
  "Negative width degrades to cardBox",
);

const validRowBox: CardBox = { x: 100, y: 250, w: 300, h: 28 };
check(
  resolveSourceBox(cardBox, validRowBox) === validRowBox,
  "valid rowBox is returned",
);

// 2. Geometry calculation with degraded box never produces NaN or (0,0)
const degradedCurve = curveForBoxes(
  resolveSourceBox(cardBox, null),
  toBox,
  undefined,
  undefined,
);
check(!Number.isNaN(degradedCurve.p0.x), "p0.x is not NaN on degraded curve");
check(!Number.isNaN(degradedCurve.p0.y), "p0.y is not NaN on degraded curve");
check(!Number.isNaN(degradedCurve.p3.x), "p3.x is not NaN on degraded curve");
check(!Number.isNaN(degradedCurve.p3.y), "p3.y is not NaN on degraded curve");
check(
  degradedCurve.p0.x !== 0 || degradedCurve.p0.y !== 0,
  "degraded curve does not jump to (0,0)",
);

const rowCurve = curveForBoxes(
  resolveSourceBox(cardBox, validRowBox),
  toBox,
  "r",
  "l",
);
check(!Number.isNaN(rowCurve.p0.x), "rowCurve p0.x is not NaN");
check(!Number.isNaN(rowCurve.p0.y), "rowCurve p0.y is not NaN");
check(
  rowCurve.p0.y >= validRowBox.y &&
    rowCurve.p0.y <= validRowBox.y + validRowBox.h,
  "row curve anchor Y for right side is within row height bounds",
);

// 3. RowBoxCache caching
const cache = new RowBoxCache();
check(cache.get(1, 101, cardBox) === null, "uncached row returns null");

class MockRect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  x: number;
  y: number;

  constructor(left: number, top: number, width: number, height: number) {
    this.left = left;
    this.top = top;
    this.width = width;
    this.height = height;
    this.right = left + width;
    this.bottom = top + height;
    this.x = left;
    this.y = top;
  }
}

// Null canvas
check(
  measureCardRowBox(null, 1, 101, cardBox) === null,
  "null canvas returns null",
);

// Cache measure with null canvas and retrieve
const measured = cache.measure(null, 1, 101, cardBox);
check(measured === null, "measure with null canvas returns null and deletes cache");

// 4. Test invalidateCard vs clear
const mockCanvas = {
  querySelector(sel: string) {
    if (sel === '.owb-card[data-block-id="1"]') {
      return {
        classList: { contains: () => false },
        getBoundingClientRect: () => new MockRect(100, 200, 300, 400),
        querySelector(rowSel: string) {
          if (rowSel.includes("101")) {
            return {
              getBoundingClientRect: () => new MockRect(100, 260, 300, 30),
            };
          }
          return null;
        },
      };
    }
    if (sel === '.owb-card[data-block-id="2"]') {
      return {
        classList: { contains: () => false },
        getBoundingClientRect: () => new MockRect(500, 200, 300, 400),
        querySelector(rowSel: string) {
          if (rowSel.includes("201")) {
            return {
              getBoundingClientRect: () => new MockRect(500, 320, 300, 30),
            };
          }
          return null;
        },
      };
    }
    return null;
  },
} as unknown as HTMLElement;

const card1Box: CardBox = { x: 100, y: 200, w: 300, h: 400 };
const card2Box: CardBox = { x: 500, y: 200, w: 300, h: 400 };

const m1 = cache.measure(mockCanvas, 1, 101, card1Box);
const m2 = cache.measure(mockCanvas, 2, 201, card2Box);
check(m1 != null && m1.y === 260, "card 1 row 101 measured correctly");
check(m2 != null && m2.y === 320, "card 2 row 201 measured correctly");

check(cache.get(1, 101, card1Box) != null, "card 1 is cached");
check(cache.get(2, 201, card2Box) != null, "card 2 is cached");

// Invalidate only card 1
cache.invalidateCard(1);
check(cache.get(1, 101, card1Box) === null, "card 1 is invalidated");
check(cache.get(2, 201, card2Box) != null, "card 2 cache is preserved after invalidating card 1");

// Clear invalidates all
cache.clear();
check(cache.get(2, 201, card2Box) === null, "cache is empty after clear");

console.log("edgeRowBoxes.test.ts ok");
