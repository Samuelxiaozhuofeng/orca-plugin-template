import type { DbId } from "../orca.d.ts";
import type { CardBox } from "./edgeGeometry.ts";

type BoxedCard = CardBox & { blockId: DbId };

/**
 * Drop live boxes that no longer belong to a persist card, and those that
 * already match persist (the gesture has been committed).
 *
 * Boxes for cards still on the board but at a different persist position
 * stay — that is an in-progress drag/resize.
 */
export function reconcileLiveBoxes(
  live: Map<DbId, CardBox>,
  cards: readonly BoxedCard[],
): void {
  const present = new Set(cards.map((card) => card.blockId));
  for (const id of [...live.keys()]) {
    if (!present.has(id)) live.delete(id);
  }
  for (const card of cards) {
    const box = live.get(card.blockId);
    if (box == null) continue;
    if (
      box.x === card.x &&
      box.y === card.y &&
      box.w === card.w &&
      box.h === card.h
    ) {
      live.delete(card.blockId);
    }
  }
}
