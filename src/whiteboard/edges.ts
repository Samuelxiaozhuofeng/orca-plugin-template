import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n.ts";
import { assertBoardWritable, writeProperties } from "./boardWrite.ts";
import { mapStoredArray, type JsonParseResult } from "./cards.ts";
import { BEND_LIMIT, bendsEqual, parseBend } from "./edgeBend.ts";

export { BEND_LIMIT, bendsEqual };

export const EDGES_PROP = "edges";
export const PROP_TYPE_TEXT = 1;

export type EdgeArrow = "end" | "both" | "none";
export type Side = "t" | "r" | "b" | "l";

/** Unit: controlLength(dist(p0, p3)). Default curve is { along: 1, across: 0 }. */
export type EdgeBendPoint = { along: number; across: number };
export type EdgeBend = { from: EdgeBendPoint; to: EdgeBendPoint };

export type WhiteboardEdge = {
  id: string;
  from: DbId;
  to: DbId;
  fromBlock?: DbId;
  label?: string;
  arrow: EdgeArrow;
  fromSide?: Side;
  toSide?: Side;
  bend?: EdgeBend;
  /** True after this line was written into the notes as a real reference. */
  linked?: true;
  /**
   * Id of the property reference this plugin created on the source note
   * (`whiteboard.link`). Distinct from `linked`, which marks the older
   * child-block method. The two never replace each other.
   */
  linkRefId?: DbId;
  /** Present only when the user picked a colour. Omitted = default ink. */
  color?: EdgeColorId;
  /** Present only when dashed. Omitted = solid. */
  style?: EdgeStyleId;
};

const ARROWS = new Set<EdgeArrow>(["end", "both", "none"]);
const SIDES = new Set<Side>(["t", "r", "b", "l"]);

/** Same five ids as `COLOR_PRESETS` in CardToolbar (default = no field). */
export const EDGE_COLOR_IDS = [
  "blue",
  "green",
  "yellow",
  "coral",
  "purple",
] as const;

export type EdgeColorId = (typeof EDGE_COLOR_IDS)[number];
export type EdgeStyleId = "dashed";

const EDGE_COLOR_SET: ReadonlySet<string> = new Set(EDGE_COLOR_IDS);

/** Unknown / empty / "default" → no colour. Never fails the parent edge. */
export function edgeColorIfValid(value: unknown): EdgeColorId | undefined {
  return typeof value === "string" && EDGE_COLOR_SET.has(value)
    ? (value as EdgeColorId)
    : undefined;
}

/** Only `"dashed"` is stored. `"solid"` / junk → omitted. Never fails the edge. */
export function edgeStyleIfValid(value: unknown): EdgeStyleId | undefined {
  return value === "dashed" ? "dashed" : undefined;
}

function asDbId(value: unknown): DbId | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asSide(value: unknown): Side | undefined {
  return typeof value === "string" && SIDES.has(value as Side)
    ? (value as Side)
    : undefined;
}

function asArrow(value: unknown): EdgeArrow {
  return typeof value === "string" && ARROWS.has(value as EdgeArrow)
    ? (value as EdgeArrow)
    : "end";
}

function asLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.length > 0 ? value : undefined;
}

export function pairKey(a: DbId, b: DbId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function edgeSourceBlock(
  edge: Pick<WhiteboardEdge, "from" | "fromBlock">,
): DbId {
  return edge.fromBlock ?? edge.from;
}

export function edgeDedupeKey(edge: {
  from: DbId;
  to: DbId;
  fromBlock?: DbId;
}): string {
  const base = pairKey(edge.from, edge.to);
  return edge.fromBlock != null ? `${base}:${edge.fromBlock}` : base;
}

export function nextEdgeId(
  from: DbId,
  to: DbId,
  existing: ReadonlyArray<{ id: string }>,
): string {
  const used = new Set(existing.map((item) => item.id));
  const prefix = `${from}-${to}-`;
  let n = 1;
  while (used.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

export function normalizeEdge(value: unknown): WhiteboardEdge | null {
  if (value == null || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const from = asDbId(raw.from);
  const to = asDbId(raw.to);
  if (from == null || to == null) return null;
  const id =
    typeof raw.id === "string" && raw.id.length > 0
      ? raw.id
      : `${from}-${to}-1`;
  const edge: WhiteboardEdge = {
    id,
    from,
    to,
    arrow: asArrow(raw.arrow),
  };
  const fromBlock = asDbId(raw.fromBlock);
  if (fromBlock != null) edge.fromBlock = fromBlock;
  const label = asLabel(raw.label);
  if (label != null) edge.label = label;
  const fromSide = asSide(raw.fromSide);
  if (fromSide != null) edge.fromSide = fromSide;
  const toSide = asSide(raw.toSide);
  if (toSide != null) edge.toSide = toSide;
  const bend = parseBend(raw.bend);
  if (bend != null) edge.bend = bend;
  if (raw.linked === true) edge.linked = true;
  const linkRefId = asDbId(raw.linkRefId);
  if (linkRefId != null) edge.linkRefId = linkRefId;
  const color = edgeColorIfValid(raw.color);
  if (color != null) edge.color = color;
  const style = edgeStyleIfValid(raw.style);
  if (style != null) edge.style = style;
  return edge;
}

/** Drops self-loops and duplicate pairs/rows. Does not drop edges whose cards are missing. */
export function sanitizeEdges(
  edges: readonly WhiteboardEdge[],
  _cardIds?: ReadonlySet<DbId>,
): WhiteboardEdge[] {
  const seen = new Set<string>();
  const out: WhiteboardEdge[] = [];
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    const key = edgeDedupeKey(edge);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(edge);
  }
  return out;
}

export function tryParseEdges(value: unknown): JsonParseResult<WhiteboardEdge[]> {
  return mapStoredArray(value, normalizeEdge);
}

export function parseEdges(value: unknown): WhiteboardEdge[] {
  const parsed = tryParseEdges(value);
  return parsed.ok ? parsed.value : [];
}

export function tryReadEdges(
  block:
    | { properties?: readonly { name: string; value?: unknown }[] }
    | undefined,
): JsonParseResult<WhiteboardEdge[]> {
  if (block == null) return { ok: true, value: [] };
  const prop = block.properties?.find((item) => item.name === EDGES_PROP);
  if (prop == null) return { ok: true, value: [] };
  return tryParseEdges(prop.value);
}

export function readEdges(
  block:
    | { properties?: readonly { name: string; value?: unknown }[] }
    | undefined,
  _cards?: ReadonlyArray<{ blockId: DbId }>,
): WhiteboardEdge[] {
  const parsed = tryReadEdges(block);
  return parsed.ok ? parsed.value : [];
}

function storedEdge(edge: WhiteboardEdge): WhiteboardEdge {
  const normalized = normalizeEdge(edge);
  if (normalized == null) {
    throw new Error(t("Whiteboard connections were not saved"));
  }
  return normalized;
}

function edgeEqual(left: WhiteboardEdge, right: WhiteboardEdge): boolean {
  return (
    left.id === right.id &&
    left.from === right.from &&
    left.to === right.to &&
    left.fromBlock === right.fromBlock &&
    left.label === right.label &&
    left.arrow === right.arrow &&
    left.fromSide === right.fromSide &&
    left.toSide === right.toSide &&
    left.linked === right.linked &&
    left.linkRefId === right.linkRefId &&
    left.color === right.color &&
    left.style === right.style &&
    bendsEqual(left.bend, right.bend)
  );
}

export function edgesEqual(
  left: WhiteboardEdge[],
  right: WhiteboardEdge[],
): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (!edgeEqual(left[i], right[i])) return false;
  }
  return true;
}

export function preparedEdges(edges: WhiteboardEdge[]): WhiteboardEdge[] {
  return sanitizeEdges(edges.map(storedEdge));
}

export async function writeEdges(
  blockId: DbId,
  edges: WhiteboardEdge[],
  _cardIds?: ReadonlySet<DbId>,
): Promise<void> {
  await assertBoardWritable(blockId);
  const stored = preparedEdges(edges);
  // Must not use invokeEditorCommand here: that API no-ops when the active
  // panel has no viewState.editor (the whiteboard panel never has one).
  const fresh = await writeProperties(blockId, [
    {
      name: EDGES_PROP,
      type: PROP_TYPE_TEXT,
      value: JSON.stringify(stored),
    },
  ]);

  const readBack = tryReadEdges(fresh ?? orca.state.blocks[blockId]);
  if (!readBack.ok || !edgesEqual(readBack.value, stored)) {
    console.error("[whiteboard] edges write verify failed", {
      blockId,
      expected: stored,
      readBack: readBack.ok ? readBack.value : "(unreadable)",
      freshProperties: fresh?.properties,
    });
    throw new Error(t("Whiteboard connections were not saved"));
  }
}

export function planEdgeColor(
  edges: readonly WhiteboardEdge[],
  id: string,
  color: string | undefined,
): WhiteboardEdge[] | null {
  const target = edges.find((edge) => edge.id === id);
  if (target == null) return null;
  const nextColor = edgeColorIfValid(color);
  if (target.color === nextColor) return null;
  return edges.map((edge) => {
    if (edge.id !== id) return edge;
    if (nextColor == null) {
      const next = { ...edge };
      delete next.color;
      return next;
    }
    return { ...edge, color: nextColor };
  });
}

export function planEdgeStyle(
  edges: readonly WhiteboardEdge[],
  id: string,
  style: string | undefined,
): WhiteboardEdge[] | null {
  const target = edges.find((edge) => edge.id === id);
  if (target == null) return null;
  const nextStyle = edgeStyleIfValid(style);
  if (target.style === nextStyle) return null;
  return edges.map((edge) => {
    if (edge.id !== id) return edge;
    if (nextStyle == null) {
      const next = { ...edge };
      delete next.style;
      return next;
    }
    return { ...edge, style: nextStyle };
  });
}
