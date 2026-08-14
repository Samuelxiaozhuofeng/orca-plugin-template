import type { DbId } from "../orca.d.ts";

export const EXTRACT_FROM_PROP = "_owbExtractFrom";
export const EXTRACT_STUB_PROP = "_owbExtractStub";
export const EXTRACT_PROP_TYPE = 1;

export type BlockOrigin = {
  originParentId: DbId;
  originLeftId: DbId | null;
};

export type ExtractRestoreInfo = {
  movedId: DbId;
  sourceCardId: DbId | null;
  originParentId: DbId;
  originLeftId: DbId | null;
  stubId: DbId;
  boardBlockId: DbId;
};

export type ExtractStubMeta = {
  to: DbId;
  source: DbId | null;
};

function asDbId(value: unknown): DbId | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function propValue(
  block:
    | { properties?: readonly { name: string; value?: unknown }[] }
    | null
    | undefined,
  name: string,
): unknown {
  return block?.properties?.find((item) => item.name === name)?.value;
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function originFromBlock(
  block: { parent?: DbId | null; left?: DbId | null } | null | undefined,
): BlockOrigin | null {
  if (block == null) return null;
  const parent = asDbId(block.parent);
  if (parent == null) return null;
  return { originParentId: parent, originLeftId: asDbId(block.left) };
}

/** Left sibling for `move-blocks` into a parent as last child. */
export function lastChildLeftId(
  children: readonly DbId[],
  moving?: ReadonlySet<DbId>,
): DbId | null {
  for (let i = children.length - 1; i >= 0; i--) {
    const id = children[i];
    if (id == null) continue;
    if (moving == null || !moving.has(id)) return id;
  }
  return null;
}

export function planRestoreAnchor(opts: {
  originParentId: DbId;
  originLeftId: DbId | null;
  stubId?: DbId | null;
  parentChildren?: readonly DbId[];
}): { parentId: DbId; leftId: DbId | null } {
  const children = opts.parentChildren;
  if (children == null) {
    return { parentId: opts.originParentId, leftId: opts.originLeftId };
  }
  if (opts.originLeftId != null && children.includes(opts.originLeftId)) {
    return { parentId: opts.originParentId, leftId: opts.originLeftId };
  }
  if (opts.stubId != null) {
    const stubAt = children.indexOf(opts.stubId);
    if (stubAt >= 0) {
      const prev = stubAt > 0 ? children[stubAt - 1] : null;
      return { parentId: opts.originParentId, leftId: prev ?? null };
    }
  }
  return { parentId: opts.originParentId, leftId: lastChildLeftId(children) };
}

export function parseExtractRestore(value: unknown): ExtractRestoreInfo | null {
  const parsed = parseJsonObject(value);
  if (parsed == null) return null;
  const movedId = asDbId(parsed.movedId);
  const originParentId = asDbId(parsed.originParentId);
  const stubId = asDbId(parsed.stubId);
  const boardBlockId = asDbId(parsed.boardBlockId);
  if (
    movedId == null ||
    originParentId == null ||
    stubId == null ||
    boardBlockId == null
  ) {
    return null;
  }
  return {
    movedId,
    sourceCardId: asDbId(parsed.sourceCardId),
    originParentId,
    originLeftId: asDbId(parsed.originLeftId),
    stubId,
    boardBlockId,
  };
}

export function serializeExtractRestore(info: ExtractRestoreInfo): string {
  return JSON.stringify({
    movedId: info.movedId,
    sourceCardId: info.sourceCardId,
    originParentId: info.originParentId,
    originLeftId: info.originLeftId,
    stubId: info.stubId,
    boardBlockId: info.boardBlockId,
  });
}

export function parseExtractStubMeta(value: unknown): ExtractStubMeta | null {
  const parsed = parseJsonObject(value);
  if (parsed == null) return null;
  const to = asDbId(parsed.to);
  if (to == null) return null;
  return { to, source: asDbId(parsed.source) };
}

export function readExtractRestore(
  block:
    | { properties?: readonly { name: string; value?: unknown }[] }
    | null
    | undefined,
): ExtractRestoreInfo | null {
  return parseExtractRestore(propValue(block, EXTRACT_FROM_PROP));
}

export function canRestoreExtract(
  block:
    | { properties?: readonly { name: string; value?: unknown }[] }
    | null
    | undefined,
): boolean {
  return readExtractRestore(block) != null;
}

export function referencedBlockIds(
  content: readonly { t?: string; v?: unknown }[] | undefined,
  refs: readonly { id?: unknown; to?: unknown; type?: unknown }[] | undefined,
): DbId[] {
  if (content == null || content.length === 0) return [];
  const byRefId = new Map<DbId, DbId>();
  for (const ref of refs ?? []) {
    const id = asDbId(ref.id);
    const to = asDbId(ref.to);
    if (id == null || to == null) continue;
    byRefId.set(id, to);
  }
  const out: DbId[] = [];
  for (const frag of content) {
    if (frag.t !== "r") continue;
    const raw = asDbId(frag.v);
    if (raw == null) continue;
    const to = byRefId.get(raw) ?? raw;
    if (!out.includes(to)) out.push(to);
  }
  return out;
}

export function isExtractStubBlock(
  block: {
    properties?: readonly { name: string; value?: unknown }[];
    content?: readonly { t?: string; v?: unknown }[];
    refs?: readonly { id?: unknown; to?: unknown; type?: unknown }[];
  } | null | undefined,
  movedId?: DbId,
): boolean {
  if (block == null) return false;
  const meta = parseExtractStubMeta(propValue(block, EXTRACT_STUB_PROP));
  if (meta != null) {
    return movedId == null || meta.to === movedId;
  }
  if (movedId == null) return false;
  const refs = referencedBlockIds(block.content, block.refs);
  return refs.length === 1 && refs[0] === movedId;
}

export function planBoardAfterRestore<
  C extends { blockId: DbId },
  E extends { from: DbId; to: DbId },
>(
  cards: readonly C[],
  edges: readonly E[],
  infos: readonly { movedId: DbId }[],
): { cards: C[]; edges: E[] } {
  const drop = new Set(infos.map((info) => info.movedId));
  return {
    cards: cards.filter((card) => !drop.has(card.blockId)),
    edges: edges.filter((edge) => !drop.has(edge.from) && !drop.has(edge.to)),
  };
}
