import { t } from "../libs/l10n.ts";
import { tryReadCards } from "./cards.ts";
import { isWhiteboardBlock, type BlockPropsLike } from "./pageBoardPlan.ts";

export type BoardCardInfo = {
  name: string;
  count: number | null;
};

export type BoardCardBlock = BlockPropsLike & {
  aliases?: string[];
  text?: string;
};

/**
 * Same rule as `boardName()` in data.ts: first alias → text → t("Whiteboard").
 * Kept here so this module stays a leaf (data.ts is a barrel; importing it
 * from blockWatch/tests is unsafe).
 */
export function boardCardName(
  block: { aliases?: string[]; text?: string } | undefined,
): string {
  const alias = block?.aliases?.[0];
  if (typeof alias === "string" && alias.trim()) return alias.trim();
  const text = typeof block?.text === "string" ? block.text.trim() : "";
  if (text) return text;
  return t("Whiteboard");
}

export function readBoardCardInfo(
  block: BoardCardBlock | undefined,
): BoardCardInfo | null {
  if (!isWhiteboardBlock(block)) return null;
  const cardsRead = tryReadCards(block);
  return {
    name: boardCardName(block ?? undefined),
    count: cardsRead.ok ? cardsRead.value.length : null,
  };
}

export function boardCardInfoEqual(
  a: BoardCardInfo | null,
  b: BoardCardInfo | null,
): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return a.name === b.name && a.count === b.count;
}
