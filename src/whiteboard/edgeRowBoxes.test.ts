import { ANCHOR_GAP, curveForBoxes, pickSide, type CardBox } from "./edgeGeometry.ts";
import {
  measureCardRowBox,
  resolveRowAnchorBox,
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

// 2. resolveRowAnchorBox rule tests

// 2.1 Target to the right of source card -> side 'r', anchor at row midline vertically and right edge + ANCHOR_GAP horizontally
const targetRight: CardBox = { x: 700, y: 250, w: 200, h: 200 };
const rightResult = resolveRowAnchorBox(cardBox, validRowBox, targetRight);
check(rightResult.side === "r", "target directly to right selects side 'r'");
check(rightResult.box === validRowBox, "side 'r' returns rowBox");
const curveRight = curveForBoxes(rightResult.box, targetRight, rightResult.side);
check(
  curveRight.p0.x === cardBox.x + cardBox.w + ANCHOR_GAP,
  "right anchor x is outside card right border by ANCHOR_GAP",
);
check(
  curveRight.p0.y === validRowBox.y + validRowBox.h / 2,
  "right anchor y is vertically aligned with row midline",
);

// 2.2 Target to the left of source card -> side 'l', anchor at row midline vertically and left edge - ANCHOR_GAP horizontally
const targetLeft: CardBox = { x: -300, y: 250, w: 200, h: 200 };
const leftResult = resolveRowAnchorBox(cardBox, validRowBox, targetLeft);
check(leftResult.side === "l", "target directly to left selects side 'l'");
check(leftResult.box === validRowBox, "side 'l' returns rowBox");
const curveLeft = curveForBoxes(leftResult.box, targetLeft, leftResult.side);
check(
  curveLeft.p0.x === cardBox.x - ANCHOR_GAP,
  "left anchor x is outside card left border by ANCHOR_GAP",
);
check(
  curveLeft.p0.y === validRowBox.y + validRowBox.h / 2,
  "left anchor y is vertically aligned with row midline",
);

// 2.3 Target below source card (pickSide(cardBox, toBox) -> 'b') -> falls back to cardBox
const targetBottom: CardBox = { x: 150, y: 800, w: 200, h: 200 };
const bottomResult = resolveRowAnchorBox(cardBox, validRowBox, targetBottom);
check(bottomResult.side === "b", "target below selects side 'b'");
check(bottomResult.box === cardBox, "side 'b' falls back to cardBox");
const curveBottom = curveForBoxes(bottomResult.box, targetBottom, bottomResult.side);
check(
  curveBottom.p0.x === cardBox.x + cardBox.w / 2,
  "bottom anchor x is at horizontal center of cardBox",
);
check(
  curveBottom.p0.y === cardBox.y + cardBox.h + ANCHOR_GAP,
  "bottom anchor y is outside bottom border of card, not inside card",
);

// 2.4 Target above source card (pickSide(cardBox, toBox) -> 't') -> falls back to cardBox
const targetTop: CardBox = { x: 150, y: -400, w: 200, h: 200 };
const topResult = resolveRowAnchorBox(cardBox, validRowBox, targetTop);
check(topResult.side === "t", "target above selects side 't'");
check(topResult.box === cardBox, "side 't' falls back to cardBox");
const curveTop = curveForBoxes(topResult.box, targetTop, topResult.side);
check(
  curveTop.p0.x === cardBox.x + cardBox.w / 2,
  "top anchor x is at horizontal center of cardBox",
);
check(
  curveTop.p0.y === cardBox.y - ANCHOR_GAP,
  "top anchor y is outside top border of card, not inside card",
);

// 2.5 Diagonal target: card aspect ratio favors 'r', but row aspect ratio favored 'b' (regression test)
const diagCard: CardBox = { x: 100, y: 100, w: 200, h: 200 };
const diagRow: CardBox = { x: 100, y: 120, w: 200, h: 20 };
const diagTarget: CardBox = { x: 350, y: 180, w: 100, h: 100 };

// Old buggy behavior demonstration:
const oldPickedSide = pickSide(diagRow, diagTarget);
check(oldPickedSide === "b", "regression baseline: pickSide on thin rowBox wrongly picks 'b'");
const oldCurve = curveForBoxes(diagRow, diagTarget, oldPickedSide);
check(
  oldCurve.p0.y > diagCard.y && oldCurve.p0.y < diagCard.y + diagCard.h,
  "regression baseline: old anchor y fell strictly inside the card rectangle",
);
check(
  oldCurve.p0.x > diagCard.x && oldCurve.p0.x < diagCard.x + diagCard.w,
  "regression baseline: old anchor x fell strictly inside the card rectangle",
);

// New correct behavior:
const diagResult = resolveRowAnchorBox(diagCard, diagRow, diagTarget);
check(diagResult.side === "r", "new behavior: picks side 'r' based on cardBox");
check(diagResult.box === diagRow, "new behavior: uses rowBox for 'r'");
const newCurve = curveForBoxes(diagResult.box, diagTarget, diagResult.side);
check(
  newCurve.p0.x === diagCard.x + diagCard.w + ANCHOR_GAP,
  "new anchor x is outside card right border",
);
check(
  newCurve.p0.y === diagRow.y + diagRow.h / 2,
  "new anchor y is at row midline",
);

// 2.6 Invalid rowBox fallback
const invalidBoxes = [
  null,
  undefined,
  { x: NaN, y: 0, w: 100, h: 50 },
  { x: 0, y: NaN, w: 100, h: 50 },
  { x: 0, y: 0, w: NaN, h: 50 },
  { x: 0, y: 0, w: 100, h: NaN },
  { x: 0, y: 0, w: 0, h: 50 },
  { x: 0, y: 0, w: -10, h: 50 },
  { x: 0, y: 0, w: 100, h: 0 },
  { x: 0, y: 0, w: 100, h: -5 },
];
for (const inv of invalidBoxes) {
  const res = resolveRowAnchorBox(cardBox, inv, targetRight);
  check(res.box === cardBox, "invalid rowBox falls back to cardBox");
  check(res.side === undefined, "invalid rowBox leaves side undefined when not explicit");

  const resExplicit = resolveRowAnchorBox(cardBox, inv, targetRight, "l");
  check(resExplicit.box === cardBox, "invalid rowBox with explicitSide falls back to cardBox");
  check(resExplicit.side === "l", "invalid rowBox preserves explicitSide");
}

// 2.7 Explicit side behavior with valid rowBox
const explicitLeft = resolveRowAnchorBox(cardBox, validRowBox, targetRight, "l");
check(explicitLeft.box === validRowBox && explicitLeft.side === "l", "explicit 'l' keeps rowBox and side 'l'");

const explicitBottom = resolveRowAnchorBox(cardBox, validRowBox, targetRight, "b");
check(explicitBottom.box === cardBox && explicitBottom.side === "b", "explicit 'b' falls back to cardBox and side 'b'");

// 2.8 Anchor point is NEVER inside the card rectangle across 360-degree target directions
for (let angleDeg = 0; angleDeg < 360; angleDeg += 15) {
  const rad = (angleDeg * Math.PI) / 180;
  const dist = 500;
  const target: CardBox = {
    x: cardBox.x + cardBox.w / 2 + Math.cos(rad) * dist - 50,
    y: cardBox.y + cardBox.h / 2 + Math.sin(rad) * dist - 50,
    w: 100,
    h: 100,
  };
  const res = resolveRowAnchorBox(cardBox, validRowBox, target);
  const curve = curveForBoxes(res.box, target, res.side);
  const p = curve.p0;

  // Assert p is NOT strictly inside cardBox [cardBox.x, cardBox.x + cardBox.w] x [cardBox.y, cardBox.y + cardBox.h]
  const insideX = p.x > cardBox.x && p.x < cardBox.x + cardBox.w;
  const insideY = p.y > cardBox.y && p.y < cardBox.y + cardBox.h;
  check(
    !(insideX && insideY),
    `anchor (${p.x}, ${p.y}) must never be inside card bounds at angle ${angleDeg}°`,
  );

  // Assert anchor is exactly on the expected offset border
  if (res.side === "l") {
    check(p.x === cardBox.x - ANCHOR_GAP, `left anchor x offset at ${angleDeg}°`);
    check(p.y === validRowBox.y + validRowBox.h / 2, `left anchor y alignment at ${angleDeg}°`);
  } else if (res.side === "r") {
    check(p.x === cardBox.x + cardBox.w + ANCHOR_GAP, `right anchor x offset at ${angleDeg}°`);
    check(p.y === validRowBox.y + validRowBox.h / 2, `right anchor y alignment at ${angleDeg}°`);
  } else if (res.side === "t") {
    check(p.y === cardBox.y - ANCHOR_GAP, `top anchor y offset at ${angleDeg}°`);
  } else if (res.side === "b") {
    check(p.y === cardBox.y + cardBox.h + ANCHOR_GAP, `bottom anchor y offset at ${angleDeg}°`);
  }
}

// 3. Geometry calculation with degraded box never produces NaN or (0,0)
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

// 4. RowBoxCache caching
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

// 5. Test invalidateCard vs clear
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
