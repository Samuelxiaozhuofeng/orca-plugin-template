import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  clampCardSize,
} from "./layout";

export const CARDS_PROP = "cards";
export const PROP_TYPE_TEXT = 1;

export type WhiteboardCard = {
  blockId: DbId;
  date: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

function normalizeCard(value: unknown): WhiteboardCard | null {
  if (value == null || typeof value !== "object") return null;
  const card = value as Record<string, unknown>;
  if (
    typeof card.blockId !== "number" ||
    typeof card.date !== "string" ||
    typeof card.x !== "number" ||
    typeof card.y !== "number"
  ) {
    return null;
  }
  const size = clampCardSize(
    typeof card.w === "number" && card.w > 0 ? card.w : CARD_WIDTH,
    typeof card.h === "number" && card.h > 0 ? card.h : CARD_HEIGHT,
  );
  return {
    blockId: card.blockId,
    date: card.date,
    x: card.x,
    y: card.y,
    w: size.w,
    h: size.h,
  };
}

function parseCardsValue(value: unknown): WhiteboardCard[] {
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
  return parseCardsValue(prop.value);
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

function cardsEqual(left: WhiteboardCard[], right: WhiteboardCard[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function writeCards(
  blockId: DbId,
  cards: WhiteboardCard[],
): Promise<void> {
  const payload = JSON.stringify(cards);
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
  if (!cardsEqual(readBack, cards)) {
    console.error("[whiteboard] cards write verify failed", {
      blockId,
      expected: cards,
      readBack,
      backendResult: result,
      freshProperties: fresh?.properties,
    });
    throw new Error(t("Whiteboard cards were not saved"));
  }

  orca.broadcasts.broadcast("orca.refresh-blocks", [blockId]);
}
