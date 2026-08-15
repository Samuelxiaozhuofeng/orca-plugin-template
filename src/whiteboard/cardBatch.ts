import type { DbId } from "../orca.d.ts";
import type { WhiteboardCard } from "./cards.ts";
import { clampCardSize } from "./layout.ts";

/** Same five colour ids as `COLOR_PRESETS` in CardToolbar (`0` = none). */
export const CARD_COLOR_DIGIT_IDS = [
  undefined,
  "blue",
  "green",
  "yellow",
  "coral",
  "purple",
] as const;

export const CARD_COLOR_IDS = [
  "blue",
  "green",
  "yellow",
  "coral",
  "purple",
] as const;

export type UnifySizeMode = "widest" | "narrowest";

export type CardStylePatch = {
  blockId: DbId;
  patch: {
    color?: string;
    w?: number;
    h?: number;
    hLock?: true;
  };
};

export function colorIdForDigit(key: string): string | undefined | null {
  if (key === "0") return undefined;
  const index = Number(key);
  if (index >= 1 && index <= 5) return CARD_COLOR_DIGIT_IDS[index];
  return null;
}

export function normalizeCardColor(
  color: string | undefined,
): string | undefined {
  if (color == null || color === "" || color === "default") return undefined;
  return (CARD_COLOR_IDS as readonly string[]).includes(color)
    ? color
    : undefined;
}

/** One patch per selected card whose colour actually changes. */
export function planColorPatches(
  cards: readonly WhiteboardCard[],
  selectedIds: ReadonlySet<DbId>,
  color: string | undefined,
): CardStylePatch[] {
  const picked = cards.filter((card) => selectedIds.has(card.blockId));
  const next = normalizeCardColor(color);
  const out: CardStylePatch[] = [];
  for (const card of picked) {
    if (card.color === next) continue;
    out.push({ blockId: card.blockId, patch: { color: next } });
  }
  return out;
}

/** Same width+height for every selected card. Needs two or more. */
export function planUnifySizePatches(
  cards: readonly WhiteboardCard[],
  selectedIds: ReadonlySet<DbId>,
  mode: UnifySizeMode,
): CardStylePatch[] {
  const picked = cards.filter((card) => selectedIds.has(card.blockId));
  if (picked.length < 2) return [];
  const widths = picked.map((card) => card.w);
  const heights = picked.map((card) => card.h);
  const rawW =
    mode === "widest" ? Math.max(...widths) : Math.min(...widths);
  const rawH =
    mode === "widest" ? Math.max(...heights) : Math.min(...heights);
  const size = clampCardSize(rawW, rawH);
  const out: CardStylePatch[] = [];
  for (const card of picked) {
    if (card.w === size.w && card.h === size.h) continue;
    out.push({
      blockId: card.blockId,
      patch: {
        w: size.w,
        h: size.h,
        ...(card.h !== size.h ? { hLock: true as const } : {}),
      },
    });
  }
  return out;
}
