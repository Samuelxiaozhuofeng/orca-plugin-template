import type { DbId } from "../orca.d.ts";

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

export type CardLoadScope = "empty" | "partial";
export type CardLoadCause = "retryable" | "gone";

export type CardLoadNotice = {
  rootId: DbId;
  scope: CardLoadScope;
  cause: CardLoadCause;
};

export type CardTreeQueueOptions = {
  simplified?: boolean;
  keep?: DbId | null;
  retryable?: ReadonlySet<DbId>;
  gone?: ReadonlySet<DbId>;
  retry?: ReadonlySet<DbId>;
  promoted?: ReadonlySet<DbId>;
  maxDepth?: number;
  maxNodes?: number;
};

export type CardTreeQueuePlan = {
  /** Block ids to send to get-blocks this pass. */
  queue: DbId[];
  /** Roots with any unresolved load problem (retryable or gone). */
  failedRoots: DbId[];
  notices: CardLoadNotice[];
};

const EMPTY_IDS: ReadonlySet<DbId> = new Set();

function skipSetForQueue(
  retryable: ReadonlySet<DbId>,
  gone: ReadonlySet<DbId>,
  retry: ReadonlySet<DbId>,
): ReadonlySet<DbId> {
  if (retryable.size === 0 && gone.size === 0) return EMPTY_IDS;
  const skip = new Set<DbId>();
  for (const id of retryable) {
    if (!retry.has(id)) skip.add(id);
  }
  for (const id of gone) skip.add(id);
  return skip;
}

export function collectMissingCardTreeIds(
  roots: readonly DbId[],
  blocks: BlockChildLookup,
  maxDepth = CARD_TREE_LOAD_MAX_DEPTH,
  maxNodes = CARD_TREE_LOAD_MAX_NODES,
  skip: ReadonlySet<DbId> = EMPTY_IDS,
  promoted?: ReadonlySet<DbId>,
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
      const block = blocks[id];
      if (block == null) {
        if (!skip.has(id)) missing.push(id);
        return;
      }
      // Placeholder excerpt needs this block; do not walk its subtree.
      if (depth > 0 && promoted?.has(id)) return;
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
  skip: ReadonlySet<DbId> = EMPTY_IDS,
  promoted?: ReadonlySet<DbId>,
): DbId[] {
  return roots.filter(
    (root) =>
      collectMissingCardTreeIds(
        [root],
        blocks,
        maxDepth,
        maxNodes,
        skip,
        promoted,
      ).length > 0,
  );
}

/**
 * Roots whose block trees should be fetched. Far-zoom LOD cards are
 * skipped; the card being edited is kept so it can stay fully rendered.
 */
export function cardTreeLoadIds(
  shown: readonly { blockId: DbId }[],
  options?: { simplified?: boolean; keep?: DbId | null },
): DbId[] {
  if (options?.simplified !== true) {
    return shown.map((card) => card.blockId);
  }
  const keep = options.keep ?? null;
  if (keep == null) return [];
  return shown.some((card) => card.blockId === keep) ? [keep] : [];
}

export function inspectCardTreeIssue(
  root: DbId,
  blocks: BlockChildLookup,
  retryable: ReadonlySet<DbId>,
  gone: ReadonlySet<DbId>,
  maxDepth = CARD_TREE_LOAD_MAX_DEPTH,
  maxNodes = CARD_TREE_LOAD_MAX_NODES,
  promoted?: ReadonlySet<DbId>,
): { scope: CardLoadScope; cause: CardLoadCause } | null {
  if (retryable.size === 0 && gone.size === 0) return null;
  const seen = new Set<DbId>();
  let nodes = 0;
  let hasRetryable = false;
  let hasGone = false;
  const walk = (id: DbId, depth: number) => {
    if (nodes >= maxNodes || depth > maxDepth) return;
    if (seen.has(id)) return;
    seen.add(id);
    nodes += 1;
    const block = blocks[id];
    if (block == null) {
      if (retryable.has(id)) hasRetryable = true;
      else if (gone.has(id)) hasGone = true;
      return;
    }
    if (depth > 0 && promoted?.has(id)) return;
    for (const child of block.children ?? []) {
      walk(child, depth + 1);
    }
  };
  walk(root, 0);
  if (!hasRetryable && !hasGone) return null;
  return {
    scope: blocks[root] == null ? "empty" : "partial",
    cause: hasRetryable ? "retryable" : "gone",
  };
}

/**
 * Which ids should be queued for get-blocks, and which card roots have
 * a load problem. Far-zoom LOD (`simplified`) queues nothing and never
 * reports a load failure — those cards only paint a title.
 */
export function planCardTreeQueue(
  shown: readonly { blockId: DbId }[],
  blocks: BlockChildLookup,
  options?: CardTreeQueueOptions,
): CardTreeQueuePlan {
  const roots = cardTreeLoadIds(shown, options);
  if (roots.length === 0) return { queue: [], failedRoots: [], notices: [] };

  const retryable = options?.retryable ?? EMPTY_IDS;
  const gone = options?.gone ?? EMPTY_IDS;
  const retry = options?.retry ?? EMPTY_IDS;
  const maxDepth = options?.maxDepth ?? CARD_TREE_LOAD_MAX_DEPTH;
  const maxNodes = options?.maxNodes ?? CARD_TREE_LOAD_MAX_NODES;
  const queue = collectMissingCardTreeIds(
    roots,
    blocks,
    maxDepth,
    maxNodes,
    skipSetForQueue(retryable, gone, retry),
    options?.promoted,
  );
  const notices: CardLoadNotice[] = [];
  if (retryable.size > 0 || gone.size > 0) {
    for (const root of roots) {
      const issue = inspectCardTreeIssue(
        root,
        blocks,
        retryable,
        gone,
        maxDepth,
        maxNodes,
        options?.promoted,
      );
      if (issue != null) {
        notices.push({ rootId: root, scope: issue.scope, cause: issue.cause });
      }
    }
  }
  return {
    queue,
    failedRoots: notices.map((notice) => notice.rootId),
    notices,
  };
}
