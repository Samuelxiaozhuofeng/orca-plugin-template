import type { Block, DbId } from "../orca.d.ts";

/**
 * How far below a card root we fetch. Images and nested lists live at
 * depth 1–3; 4 covers a toggle/callout around an image without pulling
 * a whole-book outline into memory.
 */
export const CARD_TREE_LOAD_MAX_DEPTH = 4;

/**
 * Per-card cap, including the root. A card is a small window; 80 blocks
 * is more than it can show without heavy scrolling.
 */
export const CARD_TREE_LOAD_MAX_NODES = 80;

export type BlockChildLookup = {
  [id: number]: { children?: DbId[] } | undefined;
};

/** IDs requested this session that the backend did not return. */
const absentIds = new Set<DbId>();
const inflight = new Map<DbId, Promise<void>>();

function liveBlocks(): BlockChildLookup {
  return orca.state.blocks as BlockChildLookup;
}

export function collectMissingCardTreeIds(
  roots: readonly DbId[],
  blocks: BlockChildLookup,
  maxDepth = CARD_TREE_LOAD_MAX_DEPTH,
  maxNodes = CARD_TREE_LOAD_MAX_NODES,
  skip: ReadonlySet<DbId> = absentIds,
): DbId[] {
  const missing: DbId[] = [];
  const seen = new Set<DbId>();

  for (const root of roots) {
    let nodes = 0;
    const walk = (id: DbId, depth: number) => {
      if (nodes >= maxNodes || depth > maxDepth) return;
      if (seen.has(id)) return;
      seen.add(id);
      nodes += 1;
      if (skip.has(id)) return;
      const block = blocks[id];
      if (block == null) {
        missing.push(id);
        return;
      }
      // Outline fold is `_repr.fold` and does not remove children ids.
      for (const child of block.children ?? []) {
        walk(child, depth + 1);
      }
    };
    walk(root, 0);
  }
  return missing;
}

export function cardRootsWithHoles(
  roots: readonly DbId[],
  blocks: BlockChildLookup,
  maxDepth = CARD_TREE_LOAD_MAX_DEPTH,
  maxNodes = CARD_TREE_LOAD_MAX_NODES,
  skip: ReadonlySet<DbId> = absentIds,
): DbId[] {
  return roots.filter(
    (root) =>
      collectMissingCardTreeIds([root], blocks, maxDepth, maxNodes, skip)
        .length > 0,
  );
}

function cacheFetchedBlocks(result: unknown, requested: readonly DbId[]): number {
  const list = Array.isArray(result) ? result : [];
  const returned = new Set<DbId>();
  let cached = 0;
  for (const item of list) {
    if (item == null || typeof item !== "object" || !("id" in item)) continue;
    const block = item as Block;
    if (typeof block.id !== "number") continue;
    orca.state.blocks[block.id] = block;
    returned.add(block.id);
    absentIds.delete(block.id);
    cached += 1;
  }
  for (const id of requested) {
    if (!returned.has(id) && orca.state.blocks[id] == null) {
      absentIds.add(id);
    }
  }
  return cached;
}

async function fetchAndCacheBlocks(ids: readonly DbId[]): Promise<number> {
  const need: DbId[] = [];
  const waiting: Promise<void>[] = [];
  for (const id of ids) {
    if (orca.state.blocks[id] != null || absentIds.has(id)) continue;
    const pending = inflight.get(id);
    if (pending != null) {
      waiting.push(pending);
      continue;
    }
    need.push(id);
  }

  let cached = 0;
  if (need.length > 0) {
    let resolveTask: () => void = () => undefined;
    const task = new Promise<void>((resolve) => {
      resolveTask = resolve;
    });
    for (const id of need) inflight.set(id, task);
    try {
      const result = await orca.invokeBackend("get-blocks", need);
      cached = cacheFetchedBlocks(result, need);
    } catch (error) {
      console.error("[whiteboard] failed to load card blocks", error);
    } finally {
      for (const id of need) inflight.delete(id);
      resolveTask();
    }
  }

  if (waiting.length > 0) {
    await Promise.all(waiting);
  }
  return cached;
}

/** Visible cards at full zoom; the card being edited even when zoomed out. */
export function cardTreeLoadIds(
  shown: readonly { blockId: DbId }[],
  degraded: boolean,
  editingId: DbId | null,
): DbId[] {
  if (!degraded) return shown.map((card) => card.blockId);
  if (
    editingId != null &&
    shown.some((card) => card.blockId === editingId)
  ) {
    return [editingId];
  }
  return [];
}

/** Fill missing nodes under `roots`, one batched get-blocks per level. */
export async function loadCardTrees(
  roots: readonly DbId[],
): Promise<{ fetched: number }> {
  const unique = [...new Set(roots)];
  if (unique.length === 0) return { fetched: 0 };

  let fetched = 0;
  for (let level = 0; level <= CARD_TREE_LOAD_MAX_DEPTH; level++) {
    const missing = collectMissingCardTreeIds(unique, liveBlocks());
    if (missing.length === 0) break;
    fetched += await fetchAndCacheBlocks(missing);
  }
  return { fetched };
}

/**
 * Load trees for the given card roots (typically the visible ones).
 * Returns a per-root generation that bumps only when that card had holes
 * that we then filled — so already-complete cards do not remount.
 */
export function useVisibleCardTrees(
  rootIds: readonly DbId[],
): Record<number, number> {
  const { useEffect, useRef, useState } = window.React;
  const [revByRoot, setRevByRoot] = useState<Record<number, number>>({});
  const idsKey = rootIds.join(",");
  const holesAtRender =
    idsKey === ""
      ? []
      : cardRootsWithHoles(idsKey.split(",").map(Number), liveBlocks());
  const holesForKeyRef = useRef<DbId[]>([]);
  const idsKeyRef = useRef<string | null>(null);
  if (idsKeyRef.current !== idsKey) {
    idsKeyRef.current = idsKey;
    holesForKeyRef.current = holesAtRender;
  }

  useEffect(() => {
    if (idsKey === "") return;
    const roots = idsKey.split(",").map(Number);
    const holes = holesForKeyRef.current;
    let cancelled = false;

    void loadCardTrees(roots).then((result) => {
      if (cancelled) return;
      if (result.fetched === 0 && holes.length === 0) return;
      const bump = holes.length > 0 ? holes : roots;
      setRevByRoot((prev: Record<number, number>) => {
        const next = { ...prev };
        for (const id of bump) {
          next[id] = (next[id] ?? 0) + 1;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return revByRoot;
}
