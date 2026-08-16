import type { Block, DbId } from "../orca.d.ts";
import { useWatchedValue } from "./blockWatch";
import type { WhiteboardCard } from "./cards";
import {
  isPluginPropertyRef,
  readEdgeLinkPropIds,
} from "./edgeLink";
import { pairKey, type WhiteboardEdge } from "./edges";

const { useMemo, useRef } = window.React;

export const REF_TYPE_INLINE = 1;
export const REF_WALK_MAX_BLOCKS = 2000;
export const REF_WALK_MAX_DEPTH = 30;

export type ReferenceEdge = {
  id: string;
  from: DbId;
  to: DbId;
};

export type ReferenceEdgesResult = {
  edges: ReferenceEdge[];
  truncated: boolean;
};

function buildOwnerMap(
  cards: readonly WhiteboardCard[],
  blocks: { [id: number]: Block | undefined },
): { owner: Map<DbId, DbId>; truncated: boolean } {
  const owner = new Map<DbId, DbId>();
  let visits = 0;
  let truncated = false;

  const walk = (root: DbId, id: DbId, depth: number) => {
    if (depth > REF_WALK_MAX_DEPTH) return;
    if (owner.has(id)) return;
    if (visits >= REF_WALK_MAX_BLOCKS) {
      truncated = true;
      return;
    }
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
  return { owner, truncated };
}

export function collectReferenceEdges(
  cards: readonly WhiteboardCard[],
  blocks: { [id: number]: Block | undefined },
  drawnPairs: ReadonlySet<string>,
): ReferenceEdgesResult {
  const { owner, truncated } = buildOwnerMap(cards, blocks);
  const seen = new Set<string>();
  const out: ReferenceEdge[] = [];

  for (const [blockId, fromCard] of owner) {
    const block = blocks[blockId];
    if (block?.refs == null) continue;
    const pluginPropIds = readEdgeLinkPropIds(block);
    for (const ref of block.refs) {
      const keep =
        ref.type === REF_TYPE_INLINE ||
        isPluginPropertyRef(ref, pluginPropIds);
      if (!keep) continue;
      const toCard = owner.get(ref.to);
      if (toCard == null || toCard === fromCard) continue;
      const key = pairKey(fromCard, toCard);
      if (drawnPairs.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ id: `ref:${key}`, from: fromCard, to: toCard });
    }
  }
  return { edges: out, truncated };
}

function liveBlocks(): { [id: number]: Block | undefined } {
  return orca.state.blocks as { [id: number]: Block | undefined };
}

export type CardRelationSnap = {
  key: string;
  slices: string;
  watchIds: DbId[];
};

export type RelationKeyStats = {
  walked: number;
};

function relationSlice(
  id: DbId,
  block: Block | undefined,
  owner: DbId | undefined,
): string {
  const children = block?.children?.join(",") ?? "";
  const pluginPropIds = readEdgeLinkPropIds(block);
  const refs = (block?.refs ?? [])
    .filter(
      (ref) =>
        ref.type === REF_TYPE_INLINE || isPluginPropertyRef(ref, pluginPropIds),
    )
    .map((ref) => `${ref.type}:${ref.to}:${ref.id}`)
    .join(",");
  return `${id}>${owner ?? ""}:${children}:${refs}:${pluginPropIds.join(",")}`;
}

function slicesOf(watchIds: readonly DbId[], blocks: { [id: number]: Block | undefined }): string {
  return watchIds.map((id) => relationSlice(id, blocks[id], undefined)).join("|");
}

export function cardRelationDirty(
  prev: CardRelationSnap,
  blocks: { [id: number]: Block | undefined },
): boolean {
  return slicesOf(prev.watchIds, blocks) !== prev.slices;
}

export function cardRelationSnap(
  rootId: DbId,
  blocks: { [id: number]: Block | undefined },
): CardRelationSnap {
  const { owner } = buildOwnerMap(
    [{ blockId: rootId, kind: "block", x: 0, y: 0, w: 1, h: 1 }],
    blocks,
  );
  const watchIds = [...owner.keys()].sort((a, b) => a - b);
  const parts: string[] = [];
  for (const id of watchIds) {
    parts.push(relationSlice(id, blocks[id], owner.get(id)));
  }
  return {
    key: parts.join("|"),
    slices: slicesOf(watchIds, blocks),
    watchIds,
  };
}

/** Fingerprint of children + inline refs in the card forest. Text is ignored. */
export function referenceRelationKey(
  cards: readonly WhiteboardCard[],
  blocks: { [id: number]: Block | undefined },
  cache?: Map<DbId, CardRelationSnap>,
  stats?: RelationKeyStats,
): string {
  if (cache != null) {
    const live = new Set(cards.map((card) => card.blockId));
    for (const id of [...cache.keys()]) {
      if (!live.has(id)) cache.delete(id);
    }
  }
  const parts: string[] = [];
  for (const card of cards) {
    const prev = cache?.get(card.blockId);
    if (prev != null && !cardRelationDirty(prev, blocks)) {
      parts.push(prev.key);
      continue;
    }
    if (stats != null) stats.walked += 1;
    const snap = cardRelationSnap(card.blockId, blocks);
    cache?.set(card.blockId, snap);
    parts.push(snap.key);
  }
  return parts.join("||");
}

export function useReferenceEdges(
  cards: readonly WhiteboardCard[],
  drawn: readonly WhiteboardEdge[],
  enabled: boolean,
): ReferenceEdgesResult {
  const cacheRef = useRef(new Map<DbId, CardRelationSnap>());
  const cardKey = cards.map((card) => card.blockId).join(",");
  const drawnKey = drawn
    .map((edge) => pairKey(edge.from, edge.to))
    .sort()
    .join("|");
  const relationKey = useWatchedValue(
    () => {
      if (!enabled || cards.length === 0) return "";
      return referenceRelationKey(cards, liveBlocks(), cacheRef.current);
    },
    () => {
      if (!enabled || cards.length === 0) return [];
      const blocks = liveBlocks();
      referenceRelationKey(cards, blocks, cacheRef.current);
      const ids: DbId[] = [];
      const seen = new Set<DbId>();
      for (const card of cards) {
        const snap = cacheRef.current.get(card.blockId);
        if (snap == null) continue;
        for (const id of snap.watchIds) {
          if (seen.has(id)) continue;
          seen.add(id);
          ids.push(id);
        }
      }
      return ids;
    },
    [enabled, cardKey],
  );

  return useMemo(() => {
    if (!enabled || cards.length === 0) {
      return { edges: [], truncated: false };
    }
    const pairs = new Set(
      drawn.map((edge) => pairKey(edge.from, edge.to)),
    );
    return collectReferenceEdges(cards, liveBlocks(), pairs);
  }, [enabled, cardKey, drawnKey, relationKey]);
}
