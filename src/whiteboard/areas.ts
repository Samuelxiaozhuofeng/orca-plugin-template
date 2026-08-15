import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n.ts";
import { assertBoardWritable, writeProperties } from "./boardWrite.ts";
import { mapStoredArray, type JsonParseResult } from "./cards.ts";

export const AREAS_PROP = "areas";
export const PROP_TYPE_TEXT = 1;

export const AREA_PAD = 24;
export const AREA_TITLE_H = 28;
export const MIN_AREA_W = 80;
export const MIN_AREA_H = 64;

export type WhiteboardArea = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
};

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function nextAreaId(
  existing: ReadonlyArray<{ id: string }>,
): string {
  const used = new Set(existing.map((item) => item.id));
  let n = 1;
  while (used.has(`area-${n}`)) n += 1;
  return `area-${n}`;
}

export function normalizeArea(value: unknown): WhiteboardArea | null {
  if (value == null || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || raw.id.length === 0) return null;
  if (typeof raw.name !== "string") return null;
  const x = asFinite(raw.x);
  const y = asFinite(raw.y);
  const w = asFinite(raw.w);
  const h = asFinite(raw.h);
  if (x == null || y == null || w == null || h == null) return null;
  if (w <= 0 || h <= 0) return null;
  return { id: raw.id, x, y, w, h, name: raw.name };
}

export function tryParseAreas(value: unknown): JsonParseResult<WhiteboardArea[]> {
  return mapStoredArray(value, normalizeArea);
}

export function parseAreas(value: unknown): WhiteboardArea[] {
  const parsed = tryParseAreas(value);
  return parsed.ok ? parsed.value : [];
}

export function areasPropertyPresent(
  block:
    | { properties?: readonly { name: string; value?: unknown }[] }
    | undefined,
): boolean {
  return block?.properties?.some((item) => item.name === AREAS_PROP) === true;
}

/** Old boards have no `areas` prop: treat as empty and do not persist `[]`. */
export function shouldPersistAreas(
  areas: readonly WhiteboardArea[],
  present: boolean,
): boolean {
  return present || areas.length > 0;
}

export function tryReadAreas(
  block:
    | { properties?: readonly { name: string; value?: unknown }[] }
    | undefined,
): JsonParseResult<WhiteboardArea[]> {
  if (block == null) return { ok: true, value: [] };
  const prop = block.properties?.find((item) => item.name === AREAS_PROP);
  if (prop == null) return { ok: true, value: [] };
  return tryParseAreas(prop.value);
}

export function readAreas(
  block:
    | { properties?: readonly { name: string; value?: unknown }[] }
    | undefined,
): WhiteboardArea[] {
  const parsed = tryReadAreas(block);
  return parsed.ok ? parsed.value : [];
}

function storedArea(area: WhiteboardArea): WhiteboardArea {
  const normalized = normalizeArea(area);
  if (normalized == null) {
    throw new Error(t("Whiteboard sections were not saved"));
  }
  return normalized;
}

function areaEqual(left: WhiteboardArea, right: WhiteboardArea): boolean {
  return (
    left.id === right.id &&
    left.x === right.x &&
    left.y === right.y &&
    left.w === right.w &&
    left.h === right.h &&
    left.name === right.name
  );
}

export function areasEqual(
  left: readonly WhiteboardArea[],
  right: readonly WhiteboardArea[],
): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (!areaEqual(left[i], right[i])) return false;
  }
  return true;
}

export function preparedAreas(areas: WhiteboardArea[]): WhiteboardArea[] {
  return areas.map(storedArea);
}

export async function writeAreas(
  blockId: DbId,
  areas: WhiteboardArea[],
  present: boolean,
): Promise<void> {
  await assertBoardWritable(blockId);
  const stored = preparedAreas(areas);
  if (!shouldPersistAreas(stored, present)) return;
  const fresh = await writeProperties(blockId, [
    {
      name: AREAS_PROP,
      type: PROP_TYPE_TEXT,
      value: JSON.stringify(stored),
    },
  ]);

  const readBack = tryReadAreas(fresh ?? orca.state.blocks[blockId]);
  if (!readBack.ok || !areasEqual(readBack.value, stored)) {
    console.error("[whiteboard] areas write verify failed", {
      blockId,
      expected: stored,
      readBack: readBack.ok ? readBack.value : "(unreadable)",
      freshProperties: fresh?.properties,
    });
    throw new Error(t("Whiteboard sections were not saved"));
  }
}

function unionBoxes(
  rects: ReadonlyArray<{ x: number; y: number; w: number; h: number }>,
): { x: number; y: number; w: number; h: number } | null {
  if (rects.length === 0) return null;
  let left = rects[0].x;
  let top = rects[0].y;
  let right = rects[0].x + rects[0].w;
  let bottom = rects[0].y + rects[0].h;
  for (let i = 1; i < rects.length; i++) {
    const box = rects[i];
    left = Math.min(left, box.x);
    top = Math.min(top, box.y);
    right = Math.max(right, box.x + box.w);
    bottom = Math.max(bottom, box.y + box.h);
  }
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Bounding box of the cards plus padding. Title bar sits in the extra top pad. */
export function planAreaFromCards(
  cards: ReadonlyArray<{ x: number; y: number; w: number; h: number }>,
): { x: number; y: number; w: number; h: number } | null {
  const bounds = unionBoxes(cards);
  if (bounds == null) return null;
  return {
    x: bounds.x - AREA_PAD,
    y: bounds.y - AREA_PAD - AREA_TITLE_H,
    w: bounds.w + AREA_PAD * 2,
    h: bounds.h + AREA_PAD * 2 + AREA_TITLE_H,
  };
}

/** Wrap-into-section requires two or more cards. */
export function planWrapAreaFromCards(
  cards: ReadonlyArray<{ x: number; y: number; w: number; h: number }>,
): { x: number; y: number; w: number; h: number } | null {
  if (cards.length < 2) return null;
  return planAreaFromCards(cards);
}

export type AreaMovePlan<
  C extends { x: number; y: number; w: number; h: number },
> = {
  areas: WhiteboardArea[];
  cards: C[];
};

/**
 * Snapshot membership against `area` (pre-move), then shift that area and
 * every contained card by the same delta. Outside cards stay put.
 */
export function planAreaMove<
  C extends { x: number; y: number; w: number; h: number },
>(
  area: WhiteboardArea,
  dx: number,
  dy: number,
  cards: readonly C[],
  areas: readonly WhiteboardArea[],
): AreaMovePlan<C> {
  const nextAreas = areas.map((item) =>
    item.id === area.id ? { ...item, x: item.x + dx, y: item.y + dy } : item,
  );
  let moved = false;
  const nextCards = cards.map((card) => {
    if (!cardInArea(card, area)) return card;
    moved = true;
    return { ...card, x: card.x + dx, y: card.y + dy };
  });
  return { areas: nextAreas, cards: moved ? nextCards : (cards as C[]) };
}

/**
 * Membership is full containment, inclusive of the border.
 * A card that straddles the frame is outside.
 */
export function cardInArea(
  card: { x: number; y: number; w: number; h: number },
  area: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    card.x >= area.x &&
    card.y >= area.y &&
    card.x + card.w <= area.x + area.w &&
    card.y + card.h <= area.y + area.h
  );
}

/** Areas-only delete. Never takes or returns cards. */
export function removeArea(
  areas: readonly WhiteboardArea[],
  id: string,
): WhiteboardArea[] {
  return areas.filter((area) => area.id !== id);
}
