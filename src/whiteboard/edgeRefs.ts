import type { Block, DbId } from "../orca.d.ts";
import type { WhiteboardCard } from "./cards";
import { pairKey, type WhiteboardEdge } from "./edges";

const { useMemo } = window.React;
const { useSnapshot } = window.Valtio;

export const REF_TYPE_INLINE = 1;
export const REF_WALK_MAX_BLOCKS = 2000;
export const REF_WALK_MAX_DEPTH = 30;

export type ReferenceEdge = {
  id: string;
  from: DbId;
  to: DbId;
};

function buildOwnerMap(
  cards: readonly WhiteboardCard[],
  blocks: { [id: number]: Block | undefined },
): Map<DbId, DbId> {
  const owner = new Map<DbId, DbId>();
  let visits = 0;

  const walk = (root: DbId, id: DbId, depth: number) => {
    if (visits >= REF_WALK_MAX_BLOCKS || depth > REF_WALK_MAX_DEPTH) return;
    if (owner.has(id)) return;
    visits += 1;
    owner.set(id, root);
    const block = blocks[id];
    if (block?.children == null) return;
    for (const child of block.children) {
      walk(root, child, depth + 1);
    }
  };

  for (const card of cards) {
    walk(card.blockId, card.blockId, 0);
  }
  return owner;
}

export function collectReferenceEdges(
  cards: readonly WhiteboardCard[],
  blocks: { [id: number]: Block | undefined },
  drawnPairs: ReadonlySet<string>,
): ReferenceEdge[] {
  const owner = buildOwnerMap(cards, blocks);
  const seen = new Set<string>();
  const out: ReferenceEdge[] = [];

  for (const [blockId, fromCard] of owner) {
    const block = blocks[blockId];
    if (block?.refs == null) continue;
    for (const ref of block.refs) {
      if (ref.type !== REF_TYPE_INLINE) continue;
      const toCard = owner.get(ref.to);
      if (toCard == null || toCard === fromCard) continue;
      const key = pairKey(fromCard, toCard);
      if (drawnPairs.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ id: `ref:${key}`, from: fromCard, to: toCard });
    }
  }
  return out;
}

export function useReferenceEdges(
  cards: readonly WhiteboardCard[],
  drawn: readonly WhiteboardEdge[],
  enabled: boolean,
): ReferenceEdge[] {
  const { blocks } = useSnapshot(orca.state);
  const cardKey = cards.map((card) => card.blockId).join(",");
  const drawnKey = drawn
    .map((edge) => pairKey(edge.from, edge.to))
    .sort()
    .join("|");

  return useMemo(() => {
    if (!enabled || cards.length === 0) return [];
    const pairs = new Set(
      drawn.map((edge) => pairKey(edge.from, edge.to)),
    );
    return collectReferenceEdges(cards, blocks, pairs);
  }, [enabled, cardKey, drawnKey, blocks]);
}
