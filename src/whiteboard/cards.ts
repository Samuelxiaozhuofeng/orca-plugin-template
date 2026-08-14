import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { emitBoardCardsChanged } from "./boardEvents";
import { assertBoardWritable, writeProperties } from "./boardWrite";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  clampCardSize,
} from "./layout";

export const CARDS_PROP = "cards";
export const PROP_TYPE_TEXT = 1;

export type WhiteboardCard = {
  blockId: DbId;
  kind: "journal" | "block";
  date?: string;
  color?: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

function dateIfString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function colorIfString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function inferKind(
  rawKind: unknown,
  date: string | undefined,
): "journal" | "block" {
  if (rawKind === "journal") {
    return date != null ? "journal" : "block";
  }
  if (rawKind === "block") return "block";
  return date != null && date.length > 0 ? "journal" : "block";
}

export function normalizeCard(value: unknown): WhiteboardCard | null {
  if (value == null || typeof value !== "object") return null;
  const card = value as Record<string, unknown>;
  if (
    typeof card.blockId !== "number" ||
    typeof card.x !== "number" ||
    typeof card.y !== "number"
  ) {
    return null;
  }
  const size = clampCardSize(
    typeof card.w === "number" && card.w > 0 ? card.w : CARD_WIDTH,
    typeof card.h === "number" && card.h > 0 ? card.h : CARD_HEIGHT,
  );
  const date = dateIfString(card.date);
  const color = colorIfString(card.color);
  const kind = inferKind(card.kind, date);
  if (kind === "journal") {
    return {
      blockId: card.blockId,
      kind: "journal",
      date,
      color,
      x: card.x,
      y: card.y,
      w: size.w,
      h: size.h,
    };
  }
  return {
    blockId: card.blockId,
    kind: "block",
    color,
    x: card.x,
    y: card.y,
    w: size.w,
    h: size.h,
  };
}

export type JsonParseResult<T> =
  | { ok: true; value: T }
  | { ok: false };

function cardsFromArray(parsed: unknown[]): WhiteboardCard[] {
  return parsed
    .map(normalizeCard)
    .filter((card): card is WhiteboardCard => card != null);
}

export function tryParseCards(value: unknown): JsonParseResult<WhiteboardCard[]> {
  if (value == null) return { ok: true, value: [] };
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return { ok: true, value: [] };
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) return { ok: false };
      return { ok: true, value: cardsFromArray(parsed) };
    } catch {
      return { ok: false };
    }
  }
  if (Array.isArray(value)) return { ok: true, value: cardsFromArray(value) };
  return { ok: false };
}

export function parseCards(value: unknown): WhiteboardCard[] {
  const parsed = tryParseCards(value);
  return parsed.ok ? parsed.value : [];
}

export function tryReadCards(
  block:
    | { properties?: readonly { name: string; value?: unknown }[] }
    | undefined,
): JsonParseResult<WhiteboardCard[]> {
  if (block == null) return { ok: true, value: [] };
  const prop = block.properties?.find((item) => item.name === CARDS_PROP);
  if (prop == null) return { ok: true, value: [] };
  return tryParseCards(prop.value);
}

export function readCards(
  block:
    | { properties?: readonly { name: string; value?: unknown }[] }
    | undefined,
): WhiteboardCard[] {
  const parsed = tryReadCards(block);
  return parsed.ok ? parsed.value : [];
}

function storedCard(card: WhiteboardCard): WhiteboardCard {
  const normalized = normalizeCard(card);
  if (normalized == null) {
    throw new Error(t("Whiteboard cards were not saved"));
  }
  return normalized;
}

function cardEqual(left: WhiteboardCard, right: WhiteboardCard): boolean {
  return (
    left.blockId === right.blockId &&
    left.kind === right.kind &&
    left.date === right.date &&
    left.color === right.color &&
    left.x === right.x &&
    left.y === right.y &&
    left.w === right.w &&
    left.h === right.h
  );
}

export function cardsEqual(
  left: WhiteboardCard[],
  right: WhiteboardCard[],
): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (!cardEqual(left[i], right[i])) return false;
  }
  return true;
}

export function preparedCards(cards: WhiteboardCard[]): WhiteboardCard[] {
  return cards.map(storedCard);
}

export async function writeCards(
  blockId: DbId,
  cards: WhiteboardCard[],
): Promise<void> {
  await assertBoardWritable(blockId);
  const stored = preparedCards(cards);
  // Must not use invokeEditorCommand here: that API no-ops when the active
  // panel has no viewState.editor (the whiteboard panel never has one).
  const fresh = await writeProperties(blockId, [
    {
      name: CARDS_PROP,
      type: PROP_TYPE_TEXT,
      value: JSON.stringify(stored),
    },
  ]);

  const readBack = tryReadCards(fresh ?? orca.state.blocks[blockId]);
  if (!readBack.ok || !cardsEqual(readBack.value, stored)) {
    console.error("[whiteboard] cards write verify failed", {
      blockId,
      expected: stored,
      readBack: readBack.ok ? readBack.value : "(unreadable)",
      freshProperties: fresh?.properties,
    });
    throw new Error(t("Whiteboard cards were not saved"));
  }

  emitBoardCardsChanged(blockId);
}
