import type { DbId } from "../orca.d.ts";
import { hitCardAt } from "./edgeGeometry.ts";

export function resolveBoardDropTarget(opts: {
  world: { x: number; y: number };
  cards: ReadonlyArray<{ blockId: DbId; x: number; y: number; w: number; h: number }>;
  movingIds: ReadonlySet<DbId>;
  currentBoardId: DbId;
  isBoardCard: (id: DbId) => boolean;
  allowDrop: boolean;
  altHeld?: boolean;
}): DbId | null {
  if (!opts.allowDrop || opts.altHeld === true) return null;
  const candidates = opts.cards.filter((card) => !opts.movingIds.has(card.blockId));
  const hit = hitCardAt(candidates, opts.world);
  if (hit == null) return null;
  if (hit === opts.currentBoardId) return null;
  if (!opts.isBoardCard(hit)) return null;
  const remaining = [...opts.movingIds].filter((id) => id !== hit);
  if (remaining.length === 0) return null;
  return hit;
}
