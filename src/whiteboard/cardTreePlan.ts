import type { DbId } from "../orca.d.ts";

/**
 * Host stores outline fold on hidden `_repr.fold` (not a Block field).
 * Never call fold-block / unfoldAll / setProperties to change it.
 */
export const REPR_PROP = "_repr";

/** Host registerBlock({ useChildren: true }) types: they draw children themselves. */
export const HOST_OWN_CHILD_TYPES = new Set([
  "quote2",
  "table2",
  "whiteboard",
]);

export const CARD_CHILD_INDENT_PX = 12;

export type CardTreeBlock = {
  children?: DbId[];
  properties?: readonly { name: string; value?: unknown }[];
};

export type CardTreeLookup = {
  [id: number]: CardTreeBlock | undefined;
};

export type CardTreeNode = {
  id: DbId;
  depth: number;
  hostOwn: boolean;
};

export function blockRepr(
  block: CardTreeBlock | null | undefined,
): Record<string, unknown> | undefined {
  const value = block?.properties?.find((prop) => prop.name === REPR_PROP)
    ?.value;
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export function isBlockFolded(
  block: CardTreeBlock | null | undefined,
): boolean {
  return !!blockRepr(block)?.fold;
}

export function hostDrawsOwnChildren(
  block: CardTreeBlock | null | undefined,
): boolean {
  const type = blockRepr(block)?.type;
  return typeof type === "string" && HOST_OWN_CHILD_TYPES.has(type);
}

export function cardTreePlanEqual(
  left: readonly CardTreeNode[],
  right: readonly CardTreeNode[],
): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    const a = left[i];
    const b = right[i];
    if (a.id !== b.id || a.depth !== b.depth || a.hostOwn !== b.hostOwn) {
      return false;
    }
  }
  return true;
}

/**
 * Depth-first nodes to show on a read-only card. Ignores `_repr.fold`
 * so a folded outline still lists children. Does not walk into types
 * that render their own children. `promoted` ids (other cards on this
 * board) are omitted with their subtrees so a block is only shown once.
 */
export function planCardBlockTree(
  rootId: DbId,
  blocks: CardTreeLookup,
  maxDepth = 4,
  maxNodes = 80,
  promoted?: ReadonlySet<DbId>,
): CardTreeNode[] {
  const out: CardTreeNode[] = [];
  const seen = new Set<DbId>();

  const walk = (id: DbId, depth: number) => {
    if (out.length >= maxNodes || depth > maxDepth) return;
    if (depth > 0 && promoted?.has(id)) return;
    if (seen.has(id)) return;
    seen.add(id);
    const block = blocks[id];
    const hostOwn = hostDrawsOwnChildren(block);
    out.push({ id, depth, hostOwn });
    if (hostOwn || block == null) return;
    for (const child of block.children ?? []) {
      walk(child, depth + 1);
    }
  };

  walk(rootId, 0);
  return out;
}
