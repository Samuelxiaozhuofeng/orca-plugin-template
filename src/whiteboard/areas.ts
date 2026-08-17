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

/** Same five ids as `COLOR_PRESETS` in CardToolbar (default = no field). */
export const AREA_COLOR_IDS = [
  "blue",
  "green",
  "yellow",
  "coral",
  "purple",
] as const;

export type AreaColorId = (typeof AREA_COLOR_IDS)[number];

const AREA_COLOR_SET: ReadonlySet<string> = new Set(AREA_COLOR_IDS);

export type WhiteboardArea = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  /** Present only when the user picked a colour. Omitted = no colour. */
  color?: AreaColorId;
  /** Present only when collapsed. Omitted = expanded. */
  collapsed?: true;
  /** Present only when the area is part of the slide sequence. */
  slide?: number;
};

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Unknown / empty / "default" → no colour. Never fails the parent area. */
export function areaColorIfValid(value: unknown): AreaColorId | undefined {
  return typeof value === "string" && AREA_COLOR_SET.has(value)
    ? (value as AreaColorId)
    : undefined;
}

/** Finite integer >= 1. Invalid / non-positive / non-integer / string → undefined. */
export function slideNumberIfValid(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 1
    ? value
    : undefined;
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
  const area: WhiteboardArea = { id: raw.id, x, y, w, h, name: raw.name };
  const color = areaColorIfValid(raw.color);
  if (color != null) area.color = color;
  if (raw.collapsed === true) area.collapsed = true;
  const slide = slideNumberIfValid(raw.slide);
  if (slide != null) area.slide = slide;
  return area;
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
    left.name === right.name &&
    left.color === right.color &&
    left.collapsed === right.collapsed &&
    left.slide === right.slide
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

/** Wrap-into-section needs at least one card. */
export function planWrapAreaFromCards(
  cards: ReadonlyArray<{ x: number; y: number; w: number; h: number }>,
): { x: number; y: number; w: number; h: number } | null {
  if (cards.length < 1) return null;
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

/** Inclusive of the border, matching `cardInArea`. */
export function pointInArea(
  x: number,
  y: number,
  area: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    x >= area.x &&
    y >= area.y &&
    x <= area.x + area.w &&
    y <= area.y + area.h
  );
}

/**
 * Area under a world-space point. Nested / overlapping frames pick the
 * smallest by area; equal size keeps the later item (same as paint order).
 */
export function hitAreaAt(
  x: number,
  y: number,
  areas: ReadonlyArray<{
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    collapsed?: boolean;
  }>,
): string | null {
  let bestId: string | null = null;
  let bestSize = Infinity;
  for (const area of areas) {
    const box = areaHitBox(area);
    if (box == null || !pointInArea(x, y, box)) continue;
    const size = box.w * box.h;
    if (size <= bestSize) {
      bestSize = size;
      bestId = area.id;
    }
  }
  return bestId;
}

/** Large frames first so nested smaller ones paint on top. */
export function sortAreasBackToFront<T extends { w: number; h: number }>(
  areas: readonly T[],
): T[] {
  return [...areas].sort((left, right) => right.w * right.h - left.w * left.h);
}

/** Areas-only delete. Never takes or returns cards. */
export function removeArea(
  areas: readonly WhiteboardArea[],
  id: string,
): WhiteboardArea[] {
  return areas.filter((area) => area.id !== id);
}

export function areaIsCollapsed(
  area: { collapsed?: boolean },
): boolean {
  return area.collapsed === true;
}

/**
 * Painted box. Collapsed areas shrink to nothing in world space — the title
 * chip above the frame is the only chrome, and it handles its own pointers.
 */
export function areaVisualBox(area: WhiteboardArea): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  if (!areaIsCollapsed(area)) {
    return { x: area.x, y: area.y, w: area.w, h: area.h };
  }
  return { x: area.x, y: area.y, w: area.w, h: 0 };
}

/** Interior of a collapsed frame is empty space; title chrome handles hits. */
export function areaHitBox(area: {
  x: number;
  y: number;
  w: number;
  h: number;
  collapsed?: boolean;
}): { x: number; y: number; w: number; h: number } | null {
  if (areaIsCollapsed(area)) return null;
  return { x: area.x, y: area.y, w: area.w, h: area.h };
}

/** Viewport culling: collapsed frames keep the title chip in view. */
export function areaCullBox(area: WhiteboardArea): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  if (!areaIsCollapsed(area)) {
    return { x: area.x, y: area.y, w: area.w, h: area.h };
  }
  const lift = AREA_TITLE_H + 8;
  return { x: area.x, y: area.y - lift, w: area.w, h: lift };
}

export function countCardsInArea(
  area: { x: number; y: number; w: number; h: number },
  cards: ReadonlyArray<{ x: number; y: number; w: number; h: number }>,
): number {
  let n = 0;
  for (const card of cards) {
    if (cardInArea(card, area)) n += 1;
  }
  return n;
}
