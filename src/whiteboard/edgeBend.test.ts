import {
  BEND_LIMIT,
  bendAfterMidDrag,
  bendFromControlPoints,
  bendsEqual,
  nearestValidAnchor,
  parseBend,
  worldToBendPoint,
} from "./edgeBend.ts";
import { curveForBoxes, pointDist, type CardBox } from "./edgeGeometry.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function almost(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) <= eps;
}

const fromBox: CardBox = { x: 10, y: 20, w: 120, h: 90 };
const toBox: CardBox = { x: 400, y: 80, w: 110, h: 70 };

const auto = curveForBoxes(fromBox, toBox);
const omitted = curveForBoxes(fromBox, toBox, undefined, undefined, undefined);
check(auto.d === omitted.d, "omitted bend matches explicit undefined");
check(
  JSON.stringify(auto) === JSON.stringify(omitted),
  "full curve object matches without bend",
);

const defaultBend = {
  from: { along: 1, across: 0 },
  to: { along: 1, across: 0 },
};
const withDefault = curveForBoxes(
  fromBox,
  toBox,
  auto.fromSide,
  auto.toSide,
  defaultBend,
);
check(auto.d === withDefault.d, "default bend d matches no-bend");
check(auto.p1.x === withDefault.p1.x && auto.p1.y === withDefault.p1.y, "p1");
check(auto.p2.x === withDefault.p2.x && auto.p2.y === withDefault.p2.y, "p2");
check(auto.p0.x === withDefault.p0.x && auto.p3.x === withDefault.p3.x, "anchors");

const bent = {
  from: { along: 1.4, across: -0.7 },
  to: { along: 0.6, across: 1.1 },
};
const curved = curveForBoxes(fromBox, toBox, "r", "l", bent);
const back = bendFromControlPoints(
  curved.p0,
  curved.p3,
  curved.fromSide,
  curved.toSide,
  curved.p1,
  curved.p2,
);
check(almost(back.from.along, bent.from.along), "roundtrip from.along");
check(almost(back.from.across, bent.from.across), "roundtrip from.across");
check(almost(back.to.along, bent.to.along), "roundtrip to.along");
check(almost(back.to.across, bent.to.across), "roundtrip to.across");

const recovered = worldToBendPoint(
  curved.p0,
  curved.fromSide,
  curved.p1,
  curved.ctrl,
);
check(almost(recovered.along, bent.from.along), "worldToBend along");
check(almost(recovered.across, bent.from.across), "worldToBend across");

const start = curveForBoxes(fromBox, toBox, "r", "l");
const target = { x: start.label.x + 28, y: start.label.y - 46 };
const midBend = bendAfterMidDrag(start, target);
const afterMid = curveForBoxes(fromBox, toBox, "r", "l", midBend);
check(pointDist(afterMid.label, target) < 0.05, "mid drag follows cursor");

const nearTo: CardBox = { x: 220, y: 0, w: 100, h: 80 };
const farTo: CardBox = { x: 400, y: 0, w: 100, h: 80 };
const fromLeft: CardBox = { x: 0, y: 0, w: 100, h: 80 };
const shape = {
  from: { along: 1.2, across: 0.4 },
  to: { along: 0.8, across: -0.5 },
};
const cNear = curveForBoxes(fromLeft, nearTo, "r", "l", shape);
const cFar = curveForBoxes(fromLeft, farTo, "r", "l", shape);
check(
  almost((cNear.p1.x - cNear.p0.x) / cNear.ctrl, (cFar.p1.x - cFar.p0.x) / cFar.ctrl),
  "p1 x scales with ctrl",
);
check(
  almost((cNear.p1.y - cNear.p0.y) / cNear.ctrl, (cFar.p1.y - cFar.p0.y) / cFar.ctrl),
  "p1 y scales with ctrl",
);
check(
  almost((cNear.p2.x - cNear.p3.x) / cNear.ctrl, (cFar.p2.x - cFar.p3.x) / cFar.ctrl),
  "p2 x scales with ctrl",
);

const shifted = curveForBoxes(
  fromLeft,
  { x: 400, y: 180, w: 100, h: 80 },
  "r",
  "l",
  shape,
);
check(shifted.fromSide === "r" && shifted.toSide === "l", "pinned sides do not flip");
check(
  almost((shifted.p1.x - shifted.p0.x) / shifted.ctrl, shape.from.along),
  "offset stays in side-normal frame",
);

const raw = parseBend({
  from: { along: 99, across: -99 },
  to: { along: 0, across: 3 },
});
check(raw != null, "parse accepts complete bend");
check(raw!.from.along === BEND_LIMIT, "along clamped high");
check(raw!.from.across === -BEND_LIMIT, "across clamped low");

check(
  parseBend({ from: { along: 1 }, to: { along: 1, across: 0 } }) == null,
  "incomplete bend dropped",
);
check(parseBend(null) == null, "null bend dropped");
check(
  parseBend({
    from: { along: Number.POSITIVE_INFINITY, across: 0 },
    to: { along: 1, across: 0 },
  }) == null,
  "non-finite bend dropped",
);
check(parseBend(undefined) == null, "missing bend stays undefined");

const bendA = { from: { along: 1, across: 0.2 }, to: { along: 1, across: 0 } };
const bendB = { from: { along: 1, across: 0.3 }, to: { along: 1, across: 0 } };
check(bendsEqual(bendA, { ...bendA, from: { ...bendA.from } }), "equal same bend");
check(!bendsEqual(bendA, bendB), "unequal when bend differs");
check(bendsEqual(undefined, undefined), "both missing bends equal");
check(!bendsEqual(undefined, defaultBend), "missing vs default not equal");

const cards = [
  { blockId: 1, x: 0, y: 0, w: 100, h: 80 },
  { blockId: 2, x: 300, y: 0, w: 100, h: 80 },
  { blockId: 3, x: 0, y: 300, w: 100, h: 80 },
];
const edge = { id: "e1", from: 1, to: 2, arrow: "end" as const };
const nearThree = { x: 50, y: 294 };
const hitThree = nearestValidAnchor(nearThree, cards, {
  edgeId: "e1",
  moving: "to",
  edge,
  edges: [edge],
});
check(hitThree?.cardId === 3 && hitThree.side === "t", "snap to free card top");

const self = nearestValidAnchor({ x: 350, y: 40 }, cards, {
  edgeId: "e1",
  moving: "from",
  edge,
  edges: [edge],
});
check(self == null, "reject snap onto the other end");

const duplicate = nearestValidAnchor(nearThree, cards, {
  edgeId: "e1",
  moving: "to",
  edge,
  edges: [
    edge,
    { id: "e2", from: 1, to: 3, arrow: "end" },
  ],
});
check(duplicate == null, "reject snap that would duplicate a pair");

const sameCardSide = nearestValidAnchor({ x: 406, y: 40 }, cards, {
  edgeId: "e1",
  moving: "to",
  edge,
  edges: [edge],
});
check(sameCardSide?.cardId === 2, "same-card different/same side is allowed");

console.log("edgeBend tests passed");
