import type { Block, DbId } from "../orca.d.ts";
import {
  chunkIds,
  GET_BLOCKS_BATCH_SIZE,
} from "./pageBoardPlan.ts";
import {
  CARD_TREE_LOAD_MAX_DEPTH,
  CARD_TREE_LOAD_MAX_NODES,
  cardRootsWithHoles,
  collectMissingCardTreeIds,
  inspectCardTreeIssue,
  type BlockChildLookup,
  type CardLoadCause,
  type CardLoadScope,
} from "./cardTreeQueue.ts";

export function planGetBlocksBatches(
  ids: readonly DbId[],
  batchSize = GET_BLOCKS_BATCH_SIZE,
): DbId[][] {
  return chunkIds(ids, batchSize);
}

export {
  CARD_TREE_LOAD_MAX_DEPTH,
  CARD_TREE_LOAD_MAX_NODES,
  cardRootsWithHoles,
  cardTreeLoadIds,
  collectMissingCardTreeIds,
  inspectCardTreeIssue,
  planCardTreeQueue,
} from "./cardTreeQueue.ts";
export type {
  BlockChildLookup,
  CardLoadCause,
  CardLoadNotice,
  CardLoadScope,
  CardTreeQueueOptions,
  CardTreeQueuePlan,
} from "./cardTreeQueue.ts";

export type VisibleCardTrees = {
  revByRoot: Record<number, number>;
  retryingRootSet: ReadonlySet<DbId>;
  retryRoot: (rootId: DbId) => void;
};

/** Backend threw or the request failed. User can retry these. */
const retryableIds = new Set<DbId>();
/** Backend returned without this id — treat as deleted. */
const goneIds = new Set<DbId>();
const inflight = new Map<DbId, Promise<void>>();
const loadListeners = new Set<() => void>();

function liveBlocks(): BlockChildLookup {
  return orca.state.blocks as BlockChildLookup;
}

function liveSkipIds(): ReadonlySet<DbId> {
  if (retryableIds.size === 0) return goneIds;
  if (goneIds.size === 0) return retryableIds;
  const skip = new Set<DbId>(retryableIds);
  for (const id of goneIds) skip.add(id);
  return skip;
}

function parsePromotedKey(key: string): Set<DbId> | undefined {
  if (key === "") return undefined;
  const ids: DbId[] = [];
  for (const part of key.split(",")) {
    const id = Number(part);
    if (Number.isFinite(id)) ids.push(id);
  }
  return new Set(ids);
}

function emitCardTreeLoad(): void {
  for (const listener of loadListeners) listener();
}

function subscribeCardTreeLoad(listener: () => void): () => void {
  loadListeners.add(listener);
  return () => {
    loadListeners.delete(listener);
  };
}

function forgetResolvedFailures(blocks: BlockChildLookup): void {
  for (const id of [...retryableIds]) {
    if (blocks[id] != null) retryableIds.delete(id);
  }
  for (const id of [...goneIds]) {
    if (blocks[id] != null) goneIds.delete(id);
  }
}

function forgetRetryableUnder(
  roots: readonly DbId[],
  blocks: BlockChildLookup,
  maxDepth: number,
  maxNodes: number,
  promoted?: ReadonlySet<DbId>,
): void {
  if (retryableIds.size === 0) return;
  const seen = new Set<DbId>();
  for (const root of roots) {
    let nodes = 0;
    const walk = (id: DbId, depth: number) => {
      if (nodes >= maxNodes || depth > maxDepth) return;
      if (seen.has(id)) return;
      seen.add(id);
      nodes += 1;
      if (retryableIds.has(id)) retryableIds.delete(id);
      const block = blocks[id];
      if (block == null) return;
      if (depth > 0 && promoted?.has(id)) return;
      for (const child of block.children ?? []) {
        walk(child, depth + 1);
      }
    };
    walk(root, 0);
  }
}

export function peekCardLoadNotice(
  rootId: DbId,
  promotedKey = "",
): { scope: CardLoadScope; cause: CardLoadCause } | null {
  const blocks = liveBlocks();
  forgetResolvedFailures(blocks);
  return inspectCardTreeIssue(
    rootId,
    blocks,
    retryableIds,
    goneIds,
    CARD_TREE_LOAD_MAX_DEPTH,
    CARD_TREE_LOAD_MAX_NODES,
    parsePromotedKey(promotedKey),
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
    retryableIds.delete(block.id);
    goneIds.delete(block.id);
    cached += 1;
  }
  for (const id of requested) {
    if (!returned.has(id) && orca.state.blocks[id] == null) {
      goneIds.add(id);
      retryableIds.delete(id);
    }
  }
  return cached;
}

async function fetchAndCacheBlocks(ids: readonly DbId[]): Promise<number> {
  const need: DbId[] = [];
  const waiting: Promise<void>[] = [];
  for (const id of ids) {
    if (orca.state.blocks[id] != null) continue;
    if (retryableIds.has(id) || goneIds.has(id)) continue;
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
      for (const batch of planGetBlocksBatches(need)) {
        try {
          const result = await orca.invokeBackend("get-blocks", batch);
          cached += cacheFetchedBlocks(result, batch);
        } catch (error) {
          console.error("[whiteboard] failed to load card blocks", error);
          for (const id of batch) {
            if (orca.state.blocks[id] == null) {
              retryableIds.add(id);
              goneIds.delete(id);
            }
          }
        }
      }
    } finally {
      for (const id of need) inflight.delete(id);
      resolveTask();
      emitCardTreeLoad();
    }
  }

  if (waiting.length > 0) {
    await Promise.all(waiting);
  }
  return cached;
}

/** Fill missing nodes under `roots`, one batched get-blocks per level. */
export async function loadCardTrees(
  roots: readonly DbId[],
  promoted?: ReadonlySet<DbId>,
): Promise<{ fetched: number }> {
  const unique = [...new Set(roots)];
  if (unique.length === 0) return { fetched: 0 };

  forgetResolvedFailures(liveBlocks());
  let fetched = 0;
  for (let level = 0; level <= CARD_TREE_LOAD_MAX_DEPTH; level++) {
    const missing = collectMissingCardTreeIds(
      unique,
      liveBlocks(),
      CARD_TREE_LOAD_MAX_DEPTH,
      CARD_TREE_LOAD_MAX_NODES,
      liveSkipIds(),
      promoted,
    );
    if (missing.length === 0) break;
    fetched += await fetchAndCacheBlocks(missing);
  }
  return { fetched };
}

export function resetCardTreeLoad(): void {
  retryableIds.clear();
  goneIds.clear();
  inflight.clear();
  loadListeners.clear();
}

/**
 * Load trees for the given card roots (typically the visible ones).
 * Returns a per-root generation that bumps only when that card had holes
 * that we then filled — so already-complete cards do not remount.
 */
export function useVisibleCardTrees(
  rootIds: readonly DbId[],
  promotedKey = "",
): VisibleCardTrees {
  const { useCallback, useEffect, useRef, useState } = window.React;
  const [revByRoot, setRevByRoot] = useState<Record<number, number>>({});
  const [retryEpoch, setRetryEpoch] = useState<number>(0);
  const [retryingRoots, setRetryingRoots] = useState<readonly DbId[]>([]);
  const [, setSessionTick] = useState<number>(0);

  useEffect(
    () => subscribeCardTreeLoad(() => setSessionTick((n: number) => n + 1)),
    [],
  );

  const idsKey = rootIds.join(",");
  const loadKey = `${idsKey}|${promotedKey}|${retryEpoch}`;
  const promoted = parsePromotedKey(promotedKey);
  const roots = idsKey === "" ? [] : idsKey.split(",").map(Number);
  const holesAtRender =
    roots.length === 0
      ? []
      : cardRootsWithHoles(
          roots,
          liveBlocks(),
          CARD_TREE_LOAD_MAX_DEPTH,
          CARD_TREE_LOAD_MAX_NODES,
          liveSkipIds(),
          promoted,
        );
  const holesForKeyRef = useRef<DbId[]>([]);
  const loadKeyRef = useRef<string | null>(null);
  if (loadKeyRef.current !== loadKey) {
    loadKeyRef.current = loadKey;
    holesForKeyRef.current = holesAtRender;
  }

  const promotedKeyRef = useRef(promotedKey);
  promotedKeyRef.current = promotedKey;

  const retryRoot = useCallback((rootId: DbId) => {
    forgetRetryableUnder(
      [rootId],
      liveBlocks(),
      CARD_TREE_LOAD_MAX_DEPTH,
      CARD_TREE_LOAD_MAX_NODES,
      parsePromotedKey(promotedKeyRef.current),
    );
    setRetryingRoots((prev: readonly DbId[]) =>
      prev.includes(rootId) ? prev : [...prev, rootId],
    );
    setRetryEpoch((n: number) => n + 1);
    emitCardTreeLoad();
  }, []);

  useEffect(() => {
    if (idsKey === "") return;
    const effectRoots = idsKey.split(",").map(Number);
    const holes = holesForKeyRef.current;
    const skipPromoted = parsePromotedKey(promotedKey);
    let cancelled = false;

    void loadCardTrees(effectRoots, skipPromoted).then((result) => {
      if (cancelled) return;
      setRetryingRoots((prev: readonly DbId[]) =>
        prev.filter((id: DbId) => !effectRoots.includes(id)),
      );
      if (result.fetched === 0 && holes.length === 0) return;
      const bump = holes.length > 0 ? holes : effectRoots;
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
  }, [idsKey, promotedKey, retryEpoch]);

  return {
    revByRoot,
    retryingRootSet: new Set(retryingRoots),
    retryRoot,
  };
}
