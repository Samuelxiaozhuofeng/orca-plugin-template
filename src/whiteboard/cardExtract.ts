import type { DbId } from "../orca.d.ts";
import { CARD_HEIGHT, CARD_WIDTH, GRID_GAP } from "./layout.ts";

export const EXTRACT_MIME = "orca-whiteboard/extract";

export type ExtractPayload = {
  source: DbId;
  block: DbId;
};

export type CardRectLike = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function isExtractableDepth(depth: number): boolean {
  return depth > 0;
}

export function cardIdsKey(cards: readonly { blockId: DbId }[]): string {
  return cards
    .map((card) => card.blockId)
    .sort((a, b) => a - b)
    .join(",");
}

export function parseIdKey(key: string): Set<DbId> {
  if (key === "") return new Set();
  const out = new Set<DbId>();
  for (const part of key.split(",")) {
    const id = Number(part);
    if (Number.isFinite(id)) out.add(id);
  }
  return out;
}

export function encodeExtractPayload(payload: ExtractPayload): string {
  return JSON.stringify({ source: payload.source, block: payload.block });
}

export function parseExtractPayload(raw: string): ExtractPayload | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed == null || typeof parsed !== "object") return null;
  const source = (parsed as { source?: unknown }).source;
  const block = (parsed as { block?: unknown }).block;
  if (typeof source !== "number" || !Number.isFinite(source)) return null;
  if (typeof block !== "number" || !Number.isFinite(block)) return null;
  return { source, block };
}

function orcaPayloadFromTransfer(
  dataTransfer: DataTransfer,
): ExtractPayload | null {
  for (const type of Array.from(dataTransfer.types)) {
    if (!type.startsWith("orca/")) continue;
    const extracted = parseOwbExtract(dataTransfer.getData(type));
    if (extracted != null) return extracted;
  }
  return null;
}

export function parseExtractSource(
  dataTransfer: DataTransfer | null | undefined,
): DbId | null {
  if (dataTransfer == null) return null;
  return (
    parseExtractPayload(dataTransfer.getData(EXTRACT_MIME))?.source ??
    orcaPayloadFromTransfer(dataTransfer)?.source ??
    null
  );
}

export function orcaBlocksPayload(
  ids: readonly DbId[],
  extract?: ExtractPayload,
): string {
  if (extract == null) return JSON.stringify({ blocks: [...ids] });
  return JSON.stringify({ blocks: [...ids], owbExtract: extract });
}

export function parseOwbExtract(raw: string): ExtractPayload | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed == null || typeof parsed !== "object") return null;
  const extract = (parsed as { owbExtract?: unknown }).owbExtract;
  if (extract == null || typeof extract !== "object") return null;
  return parseExtractPayload(JSON.stringify(extract));
}

/** Nearest ancestor that is already a card on this board. */
export function findOwningCardId(
  blockId: DbId,
  cardIds: ReadonlySet<DbId>,
  blocks: { [id: number]: { parent?: DbId | null } | undefined },
): DbId | null {
  let parentId = blocks[blockId]?.parent ?? null;
  const seen = new Set<DbId>([blockId]);
  while (typeof parentId === "number" && Number.isFinite(parentId)) {
    if (seen.has(parentId)) break;
    seen.add(parentId);
    if (cardIds.has(parentId)) return parentId;
    parentId = blocks[parentId]?.parent ?? null;
  }
  return null;
}

export function rectsOverlap(a: CardRectLike, b: CardRectLike): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function findVacantCardPosition(
  existing: readonly CardRectLike[],
  prefer?: CardRectLike,
): { x: number; y: number } {
  const w = CARD_WIDTH;
  const h = CARD_HEIGHT;
  const stepX = CARD_WIDTH + GRID_GAP;
  const stepY = CARD_HEIGHT + GRID_GAP;
  let startX = 0;
  let startY = 0;
  if (prefer != null) {
    startX = prefer.x + prefer.w + GRID_GAP;
    startY = prefer.y;
  } else if (existing.length > 0) {
    let minX = Infinity;
    let maxBottom = -Infinity;
    for (const card of existing) {
      if (card.x < minX) minX = card.x;
      if (card.y + card.h > maxBottom) maxBottom = card.y + card.h;
    }
    startX = minX;
    startY = maxBottom + GRID_GAP;
  }

  for (let row = 0; row < 40; row++) {
    for (let col = 0; col < 8; col++) {
      const next = { x: startX + col * stepX, y: startY + row * stepY, w, h };
      if (!existing.some((card) => rectsOverlap(card, next))) {
        return { x: next.x, y: next.y };
      }
    }
  }
  return { x: startX, y: startY + 40 * stepY };
}

export type ExtractEdgeDraft = {
  id: string;
  from: DbId;
  to: DbId;
  arrow: "end";
};

function pairKey(a: DbId, b: DbId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function nextExtractEdgeId(
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

export function planExtractEdge(
  from: DbId,
  to: DbId,
  existing: ReadonlyArray<{ id: string; from: DbId; to: DbId }>,
): ExtractEdgeDraft | null {
  if (from === to) return null;
  const key = pairKey(from, to);
  if (existing.some((edge) => pairKey(edge.from, edge.to) === key)) {
    return null;
  }
  return {
    id: nextExtractEdgeId(from, to, existing),
    from,
    to,
    arrow: "end",
  };
}
