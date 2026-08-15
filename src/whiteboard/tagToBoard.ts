import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n.ts";
import type { WhiteboardCard } from "./cards.ts";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  GRID_GAP,
  layoutGrid,
} from "./layout.ts";

/** Cap so a busy tag cannot flood a board in one click. */
export const TAG_TO_BOARD_LIMIT = 200;
export const TAG_TO_BOARD_COLUMNS = 4;

export type TagToBoardPlan = {
  incoming: WhiteboardCard[];
  added: number;
  skippedExisting: number;
  skippedSelf: number;
  truncated: number;
  limit: number;
  sourceCount: number;
};

export function tagNameFromBlock(block: {
  aliases?: readonly string[];
  text?: string;
}): string | null {
  const alias = block.aliases?.[0];
  if (typeof alias === "string" && alias.trim()) {
    const name = alias.trim().replace(/^#+/, "").trim();
    return name || null;
  }
  const text = typeof block.text === "string" ? block.text.trim() : "";
  if (!text) return null;
  const name = text.replace(/^#+/, "").trim();
  return name || null;
}

/** Pull block ids out of `get-blocks-with-tags` whether it returns ids or blocks. */
export function collectTaggedBlockIds(result: unknown): DbId[] {
  if (result == null) return [];
  if (!Array.isArray(result)) {
    throw new Error("get-blocks-with-tags did not return an array");
  }
  const ids: DbId[] = [];
  for (const item of result) {
    if (typeof item === "number" && Number.isFinite(item)) {
      ids.push(item);
      continue;
    }
    if (item != null && typeof item === "object" && "id" in item) {
      const id = (item as { id: unknown }).id;
      if (typeof id === "number" && Number.isFinite(id)) ids.push(id);
    }
  }
  if (result.length > 0 && ids.length === 0) {
    throw new Error("get-blocks-with-tags returned an unexpected shape");
  }
  return ids;
}

function originBelowCards(cards: readonly WhiteboardCard[]): {
  x: number;
  y: number;
} {
  if (cards.length === 0) return { x: 0, y: 0 };
  let minX = Infinity;
  let maxBottom = -Infinity;
  for (const card of cards) {
    if (card.x < minX) minX = card.x;
    if (card.y + card.h > maxBottom) maxBottom = card.y + card.h;
  }
  return { x: minX, y: maxBottom + GRID_GAP };
}

/**
 * Decide which tagged notes become new cards. Does not move or copy notes —
 * each incoming card is only a pointer (block id + box).
 */
export function planTagToBoardCards(input: {
  blockIds: readonly DbId[];
  existing: readonly WhiteboardCard[];
  limit: number;
  boardBlockId?: DbId;
}): TagToBoardPlan {
  const limit = Number.isFinite(input.limit)
    ? Math.max(0, Math.floor(input.limit))
    : 0;
  const occupied = new Set(input.existing.map((card) => card.blockId));
  let skippedExisting = 0;
  let skippedSelf = 0;
  const candidates: DbId[] = [];
  const seen = new Set<DbId>();

  for (const id of input.blockIds) {
    if (input.boardBlockId != null && id === input.boardBlockId) {
      skippedSelf += 1;
      continue;
    }
    if (occupied.has(id) || seen.has(id)) {
      skippedExisting += 1;
      continue;
    }
    seen.add(id);
    candidates.push(id);
  }

  const truncated = Math.max(0, candidates.length - limit);
  const chosen = candidates.slice(0, limit);
  const origin = originBelowCards(input.existing);
  const incoming = chosen.map((blockId, index) => {
    const pos = layoutGrid(index, TAG_TO_BOARD_COLUMNS, origin);
    const card: WhiteboardCard = {
      blockId,
      kind: "block",
      x: pos.x,
      y: pos.y,
      w: CARD_WIDTH,
      h: CARD_HEIGHT,
    };
    return card;
  });

  return {
    incoming,
    added: incoming.length,
    skippedExisting,
    skippedSelf,
    truncated,
    limit,
    sourceCount: input.blockIds.length,
  };
}

export function tagToBoardMessage(plan: TagToBoardPlan): string {
  if (plan.sourceCount === 0) return t("This tag has no notes");
  const parts: string[] = [];
  if (plan.added > 0) {
    parts.push(t("Added ${added} cards", { added: String(plan.added) }));
  }
  if (plan.skippedExisting > 0) {
    parts.push(
      t("skipped ${existing} already on the board", {
        existing: String(plan.skippedExisting),
      }),
    );
  }
  if (plan.skippedSelf > 0) {
    parts.push(
      t("skipped ${self} that would nest this board", {
        self: String(plan.skippedSelf),
      }),
    );
  }
  if (plan.truncated > 0) {
    parts.push(
      t("only the first ${limit} notes were placed", {
        limit: String(plan.limit),
      }),
    );
  }
  if (parts.length === 0) return t("Nothing to add to the board");
  return parts.join(t(", "));
}
