import type { DbId } from "../orca.d.ts";
import {
  anchorPoint,
  controlLength,
  perpClockwise,
  pointDist,
  sideNormal,
  type CardBox,
  type EdgeCurve,
  type Point,
} from "./edgeGeometry.ts";
import type {
  EdgeBend,
  EdgeBendPoint,
  Side,
  WhiteboardEdge,
} from "./edges.ts";

export const BEND_LIMIT = 20;
export const ANCHOR_SNAP_RADIUS = 60;
export const EDGE_SIDES: readonly Side[] = ["t", "r", "b", "l"];

const MID_CTRL_SCALE = 4 / 3;

function pairKey(a: DbId, b: DbId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function clampBendValue(n: number): number {
  return Math.min(BEND_LIMIT, Math.max(-BEND_LIMIT, n));
}

export function parseBend(value: unknown): EdgeBend | undefined {
  if (value == null || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const from = asBendPoint(raw.from);
  const to = asBendPoint(raw.to);
  if (from == null || to == null) return undefined;
  return { from, to };
}

function asBendPoint(value: unknown): EdgeBendPoint | null {
  if (value == null || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const along = asFiniteNumber(raw.along);
  const across = asFiniteNumber(raw.across);
  if (along == null || across == null) return null;
  return { along: clampBendValue(along), across: clampBendValue(across) };
}

export function bendsEqual(
  left: EdgeBend | undefined,
  right: EdgeBend | undefined,
): boolean {
  if (left == null && right == null) return true;
  if (left == null || right == null) return false;
  return (
    left.from.along === right.from.along &&
    left.from.across === right.from.across &&
    left.to.along === right.to.along &&
    left.to.across === right.to.across
  );
}

export function clampBendPoint(point: EdgeBendPoint): EdgeBendPoint {
  return {
    along: clampBendValue(point.along),
    across: clampBendValue(point.across),
  };
}

export function clampBend(bend: EdgeBend): EdgeBend {
  return { from: clampBendPoint(bend.from), to: clampBendPoint(bend.to) };
}

export function worldToBendPoint(
  origin: Point,
  side: Side,
  world: Point,
  ctrl: number,
): EdgeBendPoint {
  const unit = ctrl === 0 ? 1 : ctrl;
  const n = sideNormal(side);
  const p = perpClockwise(n);
  const dx = (world.x - origin.x) / unit;
  const dy = (world.y - origin.y) / unit;
  return {
    along: dx * n.x + dy * n.y,
    across: dx * p.x + dy * p.y,
  };
}

export function bendFromControlPoints(
  p0: Point,
  p3: Point,
  fromSide: Side,
  toSide: Side,
  p1: Point,
  p2: Point,
): EdgeBend {
  const ctrl = controlLength(pointDist(p0, p3));
  return {
    from: worldToBendPoint(p0, fromSide, p1, ctrl),
    to: worldToBendPoint(p3, toSide, p2, ctrl),
  };
}

/**
 * Move B(0.5) to `world`. Across-chord motion bows both handles (C-curve);
 * along-chord motion shears them opposite ways (S-curve).
 */
export function bendAfterMidDrag(start: EdgeCurve, world: Point): EdgeBend {
  const dx = world.x - start.label.x;
  const dy = world.y - start.label.y;
  const chord = pointDist(start.p0, start.p3);
  let shearX = 0;
  let shearY = 0;
  if (chord > 1e-6) {
    const ux = (start.p3.x - start.p0.x) / chord;
    const uy = (start.p3.y - start.p0.y) / chord;
    const vx = uy;
    const vy = -ux;
    const alongAmt = dx * ux + dy * uy;
    shearX = MID_CTRL_SCALE * alongAmt * vx;
    shearY = MID_CTRL_SCALE * alongAmt * vy;
  }
  const p1 = {
    x: start.p1.x + MID_CTRL_SCALE * dx + shearX,
    y: start.p1.y + MID_CTRL_SCALE * dy + shearY,
  };
  const p2 = {
    x: start.p2.x + MID_CTRL_SCALE * dx - shearX,
    y: start.p2.y + MID_CTRL_SCALE * dy - shearY,
  };
  return clampBend(
    bendFromControlPoints(
      start.p0,
      start.p3,
      start.fromSide,
      start.toSide,
      p1,
      p2,
    ),
  );
}

export function bendAfterCtrlDrag(
  start: EdgeCurve,
  which: "from" | "to",
  world: Point,
): EdgeBend {
  const p1 = which === "from" ? world : start.p1;
  const p2 = which === "to" ? world : start.p2;
  return clampBend(
    bendFromControlPoints(
      start.p0,
      start.p3,
      start.fromSide,
      start.toSide,
      p1,
      p2,
    ),
  );
}

export type AnchorCandidate = {
  cardId: DbId;
  side: Side;
  point: Point;
};

export function nearestValidAnchor(
  world: Point,
  cards: ReadonlyArray<{ blockId: DbId } & CardBox>,
  opts: {
    edgeId: string;
    moving: "from" | "to";
    edge: WhiteboardEdge;
    edges: readonly WhiteboardEdge[];
  },
): AnchorCandidate | null {
  const otherId = opts.moving === "from" ? opts.edge.to : opts.edge.from;
  const occupied = new Set<string>();
  for (const item of opts.edges) {
    if (item.id === opts.edgeId) continue;
    occupied.add(pairKey(item.from, item.to));
  }

  let best: AnchorCandidate | null = null;
  let bestDist = ANCHOR_SNAP_RADIUS;
  for (const card of cards) {
    if (card.blockId === otherId) continue;
    if (occupied.has(pairKey(card.blockId, otherId))) continue;
    for (const side of EDGE_SIDES) {
      const point = anchorPoint(card, side);
      const dist = pointDist(world, point);
      if (dist <= bestDist) {
        bestDist = dist;
        best = { cardId: card.blockId, side, point };
      }
    }
  }
  return best;
}
