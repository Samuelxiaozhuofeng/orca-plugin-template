import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";

export const EDGES_PROP = "edges";
export const PROP_TYPE_TEXT = 1;

export type EdgeArrow = "end" | "both" | "none";
export type Side = "t" | "r" | "b" | "l";

export type WhiteboardEdge = {
  id: string;
  from: DbId;
  to: DbId;
  label?: string;
  arrow: EdgeArrow;
  fromSide?: Side;
  toSide?: Side;
  /** True after this line was written into the notes as a real reference. */
  linked?: true;
};

const ARROWS = new Set<EdgeArrow>(["end", "both", "none"]);
const SIDES = new Set<Side>(["t", "r", "b", "l"]);

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
  const label = asLabel(raw.label);
  if (label != null) edge.label = label;
  const fromSide = asSide(raw.fromSide);
  if (fromSide != null) edge.fromSide = fromSide;
  const toSide = asSide(raw.toSide);
  if (toSide != null) edge.toSide = toSide;
  if (raw.linked === true) edge.linked = true;
  return edge;
}

export function sanitizeEdges(
  edges: readonly WhiteboardEdge[],
  cardIds: ReadonlySet<DbId>,
): WhiteboardEdge[] {
  const seen = new Set<string>();
  const out: WhiteboardEdge[] = [];
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    if (!cardIds.has(edge.from) || !cardIds.has(edge.to)) continue;
    const key = pairKey(edge.from, edge.to);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(edge);
  }
  return out;
}

export function parseEdges(value: unknown): WhiteboardEdge[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return [];
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(normalizeEdge)
    .filter((edge): edge is WhiteboardEdge => edge != null);
}

export function readEdges(
  block:
    | { properties?: readonly { name: string; value?: unknown }[] }
    | undefined,
  cards?: ReadonlyArray<{ blockId: DbId }>,
): WhiteboardEdge[] {
  if (block == null) return [];
  const prop = block.properties?.find((item) => item.name === EDGES_PROP);
  if (prop == null) return [];
  const parsed = parseEdges(prop.value);
  if (cards == null) return parsed;
  return sanitizeEdges(parsed, new Set(cards.map((card) => card.blockId)));
}

function applyReturnedBlocks(result: unknown): void {
  const blocks = Array.isArray(result)
    ? Array.isArray(result[1])
      ? result[1]
      : result
    : [];
  for (const item of blocks) {
    if (item != null && typeof item === "object" && "id" in item) {
      const next = item as Block;
      if (typeof next.id === "number") {
        orca.state.blocks[next.id] = next;
      }
    }
  }
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
    left.label === right.label &&
    left.arrow === right.arrow &&
    left.fromSide === right.fromSide &&
    left.toSide === right.toSide &&
    left.linked === right.linked
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

export async function writeEdges(
  blockId: DbId,
  edges: WhiteboardEdge[],
  cardIds?: ReadonlySet<DbId>,
): Promise<void> {
  const stored = (cardIds == null
    ? edges.map(storedEdge)
    : sanitizeEdges(edges.map(storedEdge), cardIds));
  const payload = JSON.stringify(stored);
  // Must not use invokeEditorCommand here: that API no-ops when the active
  // panel has no viewState.editor (the whiteboard panel never has one).
  const result = await orca.invokeBackend(
    "set-properties",
    [blockId],
    [
      {
        name: EDGES_PROP,
        type: PROP_TYPE_TEXT,
        value: payload,
      },
    ],
  );
  applyReturnedBlocks(result);

  const fresh = (await orca.invokeBackend("get-block", blockId)) as
    | Block
    | null;
  if (fresh != null && typeof fresh.id === "number") {
    orca.state.blocks[fresh.id] = fresh;
  }

  const readBack = parseEdges(
    (fresh ?? orca.state.blocks[blockId])?.properties?.find(
      (item) => item.name === EDGES_PROP,
    )?.value,
  );
  const expected = stored;
  if (!edgesEqual(readBack, expected)) {
    console.error("[whiteboard] edges write verify failed", {
      blockId,
      expected,
      readBack,
      backendResult: result,
      freshProperties: fresh?.properties,
    });
    throw new Error(t("Whiteboard connections were not saved"));
  }

  orca.broadcasts.broadcast("orca.refresh-blocks", [blockId]);
}
