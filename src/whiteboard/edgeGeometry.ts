import type { DbId } from "../orca.d.ts";
import type { Side } from "./edges";

export type CardBox = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

export const ANCHOR_GAP = 6;
export const CTRL_RATIO = 0.42;
export const CTRL_MIN = 40;
export const CTRL_MAX = 150;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function cardCenter(box: CardBox): Point {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

export function pickSide(box: CardBox, toward: CardBox): Side {
  const a = cardCenter(box);
  const b = cardCenter(toward);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) * box.h > Math.abs(dy) * box.w) {
    return dx >= 0 ? "r" : "l";
  }
  return dy >= 0 ? "b" : "t";
}

export function pickSides(
  from: CardBox,
  to: CardBox,
): { fromSide: Side; toSide: Side } {
  return { fromSide: pickSide(from, to), toSide: pickSide(to, from) };
}

export function resolveSides(
  from: CardBox,
  to: CardBox,
  fromSide?: Side,
  toSide?: Side,
): { fromSide: Side; toSide: Side } {
  const auto = pickSides(from, to);
  return {
    fromSide: fromSide ?? auto.fromSide,
    toSide: toSide ?? auto.toSide,
  };
}

export function sideNormal(side: Side): Point {
  if (side === "t") return { x: 0, y: -1 };
  if (side === "r") return { x: 1, y: 0 };
  if (side === "b") return { x: 0, y: 1 };
  return { x: -1, y: 0 };
}

export function sideMidpoint(box: CardBox, side: Side): Point {
  if (side === "t") return { x: box.x + box.w / 2, y: box.y };
  if (side === "r") return { x: box.x + box.w, y: box.y + box.h / 2 };
  if (side === "b") return { x: box.x + box.w / 2, y: box.y + box.h };
  return { x: box.x, y: box.y + box.h / 2 };
}

export function anchorPoint(
  box: CardBox,
  side: Side,
  gap = ANCHOR_GAP,
): Point {
  const mid = sideMidpoint(box, side);
  const n = sideNormal(side);
  return { x: mid.x + n.x * gap, y: mid.y + n.y * gap };
}

export function pointDist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function controlLength(anchorDist: number): number {
  return clamp(anchorDist * CTRL_RATIO, CTRL_MIN, CTRL_MAX);
}

export type EdgeCurve = {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
  fromSide: Side;
  toSide: Side;
  ctrl: number;
  d: string;
  label: Point;
};

export function cubicPath(p0: Point, p1: Point, p2: Point, p3: Point): string {
  return `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;
}

export function labelPoint(p0: Point, p1: Point, p2: Point, p3: Point): Point {
  return {
    x: (p0.x + 3 * p1.x + 3 * p2.x + p3.x) / 8,
    y: (p0.y + 3 * p1.y + 3 * p2.y + p3.y) / 8,
  };
}

export function curveForBoxes(
  from: CardBox,
  to: CardBox,
  fromSide?: Side,
  toSide?: Side,
): EdgeCurve {
  const sides = resolveSides(from, to, fromSide, toSide);
  const p0 = anchorPoint(from, sides.fromSide);
  const p3 = anchorPoint(to, sides.toSide);
  const ctrl = controlLength(pointDist(p0, p3));
  const n0 = sideNormal(sides.fromSide);
  const n3 = sideNormal(sides.toSide);
  const p1 = { x: p0.x + n0.x * ctrl, y: p0.y + n0.y * ctrl };
  const p2 = { x: p3.x + n3.x * ctrl, y: p3.y + n3.y * ctrl };
  return {
    p0,
    p1,
    p2,
    p3,
    fromSide: sides.fromSide,
    toSide: sides.toSide,
    ctrl,
    d: cubicPath(p0, p1, p2, p3),
    label: labelPoint(p0, p1, p2, p3),
  };
}

export function cursorBox(world: Point): CardBox {
  return { x: world.x - 1, y: world.y - 1, w: 2, h: 2 };
}

export function hitCardAt(
  cards: ReadonlyArray<{ blockId: DbId } & CardBox>,
  world: Point,
): DbId | null {
  for (let i = cards.length - 1; i >= 0; i--) {
    const card = cards[i];
    if (
      world.x >= card.x &&
      world.x <= card.x + card.w &&
      world.y >= card.y &&
      world.y <= card.y + card.h
    ) {
      return card.blockId;
    }
  }
  return null;
}
