import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { emitBoardCardsChanged } from "./boardEvents";
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

export function parseCards(value: unknown): WhiteboardCard[] {
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
    .map(normalizeCard)
    .filter((card): card is WhiteboardCard => card != null);
}

export function readCards(
  block:
    | { properties?: readonly { name: string; value?: unknown }[] }
    | undefined,
): WhiteboardCard[] {
  if (block == null) return [];
  const prop = block.properties?.find((item) => item.name === CARDS_PROP);
  if (prop == null) return [];
  return parseCards(prop.value);
}

function applyReturnedBlocks(result: unknown): void {
  const blocks = Array.isArray(result)
    ? Array.isArray(result[1])
      ? result[1]
      : result
    : [];
  for (const item of blocks) {
    if (item != null && typeof item === "object" && "id" in item) {
      const block = item as Block;
      if (typeof block.id === "number") {
        orca.state.blocks[block.id] = block;
      }
    }
  }
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

export async function writeCards(
  blockId: DbId,
  cards: WhiteboardCard[],
): Promise<void> {
  const stored = cards.map(storedCard);
  const payload = JSON.stringify(stored);
  // Must not use invokeEditorCommand here: that API no-ops when the active
  // panel has no viewState.editor (the whiteboard panel never has one).
  const result = await orca.invokeBackend(
    "set-properties",
    [blockId],
    [
      {
        name: CARDS_PROP,
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

  const readBack = readCards(fresh ?? orca.state.blocks[blockId]);
  if (!cardsEqual(readBack, stored)) {
    console.error("[whiteboard] cards write verify failed", {
      blockId,
      expected: stored,
      readBack,
      backendResult: result,
      freshProperties: fresh?.properties,
    });
    throw new Error(t("Whiteboard cards were not saved"));
  }

  orca.broadcasts.broadcast("orca.refresh-blocks", [blockId]);
  emitBoardCardsChanged(blockId);
}
