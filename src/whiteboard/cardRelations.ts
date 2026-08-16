import type { Block, BlockRef, DbId } from "../orca.d.ts";
import type { WhiteboardCard } from "./cards";
import {
  isPluginPropertyRef,
  readEdgeLinkPropIds,
  REF_TYPE_PROPERTY,
} from "./edgeLink";
import { buildOwnerMap, REF_TYPE_INLINE } from "./edgeRefs";
import { journalDateKey } from "./journals";
import { formatCardTitle } from "./layout";
import { isWhiteboardBlock } from "./pageBoardPlan";

export const RELATION_MAP_LIMIT = 12;
export const RELATION_SNIPPET_MAX = 60;

export type RelationDir = "out" | "in" | "both";
export type RelationKind = "journal" | "whiteboard" | "tag" | "note";

export type RelationNode = {
  blockId: DbId;
  onBoard: boolean;
  ownerCardId: DbId | null;
  dir: RelationDir;
  /** My-side block that mentioned them. */
  outSnippetId?: DbId;
  /** Their-side block that mentioned me. */
  inSnippetId?: DbId;
};

export type RelationMapModel = {
  total: number;
  offBoard: number;
  onBoard: number;
  hidden: number;
  incomingTotal: number;
  outgoingTotal: number;
  incoming: RelationNode[];
  outgoing: RelationNode[];
  shown: RelationNode[];
  offBoardIds: DbId[];
};

type RefLike = Pick<BlockRef, "id" | "type" | "from" | "to">;

function keepRelationRef(
  ref: RefLike,
  source: { properties?: readonly { name: string; value?: unknown }[] } | undefined,
): boolean {
  if (ref.type === REF_TYPE_INLINE) return true;
  if (ref.type !== REF_TYPE_PROPERTY) return false;
  if (source == null) return true;
  return isPluginPropertyRef(ref, readEdgeLinkPropIds(source));
}

function stubCard(blockId: DbId): WhiteboardCard {
  return { blockId, kind: "block", x: 0, y: 0, w: 1, h: 1 };
}

function firstAlias(block: Block | undefined): string | null {
  const alias = block?.aliases?.[0];
  if (typeof alias === "string" && alias.trim()) return alias.trim();
  return null;
}

function addNode(
  byId: Map<DbId, RelationNode>,
  id: DbId,
  dir: "out" | "in",
  snippetId: DbId,
  selfOwner: ReadonlyMap<DbId, DbId>,
  boardOwner: ReadonlyMap<DbId, DbId>,
): void {
  if (selfOwner.has(id)) return;
  const existing = byId.get(id);
  if (existing != null) {
    if (existing.dir !== dir) existing.dir = "both";
    if (dir === "out" && existing.outSnippetId == null) {
      existing.outSnippetId = snippetId;
    }
    if (dir === "in" && existing.inSnippetId == null) {
      existing.inSnippetId = snippetId;
    }
    return;
  }
  const ownerCardId = boardOwner.get(id) ?? null;
  byId.set(id, {
    blockId: id,
    onBoard: ownerCardId != null,
    ownerCardId,
    dir,
    outSnippetId: dir === "out" ? snippetId : undefined,
    inSnippetId: dir === "in" ? snippetId : undefined,
  });
}

/** One-hop refs / back-refs of a card tree. Off-board nodes are ranked first. */
export function collectCardRelations(
  rootId: DbId,
  cards: readonly WhiteboardCard[],
  blocks: { [id: number]: Block | undefined },
  limit = RELATION_MAP_LIMIT,
): RelationMapModel {
  const { owner: boardOwner } = buildOwnerMap(cards, blocks);
  const { owner: selfOwner } = buildOwnerMap([stubCard(rootId)], blocks);
  const byId = new Map<DbId, RelationNode>();

  for (const blockId of selfOwner.keys()) {
    const block = blocks[blockId];
    if (block == null) continue;
    for (const ref of block.refs ?? []) {
      if (!keepRelationRef(ref, block)) continue;
      addNode(byId, ref.to, "out", blockId, selfOwner, boardOwner);
    }
    for (const ref of block.backRefs ?? []) {
      if (!keepRelationRef(ref, blocks[ref.from])) continue;
      addNode(byId, ref.from, "in", ref.from, selfOwner, boardOwner);
    }
  }

  const all = [...byId.values()].sort((a, b) => a.blockId - b.blockId);
  const off = all.filter((node) => !node.onBoard);
  const on = all.filter((node) => node.onBoard);
  const shown = [...off, ...on].slice(0, Math.max(0, limit));
  const incoming = shown.filter(
    (node) => node.dir === "in" || node.dir === "both",
  );
  const outgoing = shown.filter(
    (node) => node.dir === "out" || node.dir === "both",
  );
  return {
    total: all.length,
    offBoard: off.length,
    onBoard: on.length,
    hidden: Math.max(0, all.length - shown.length),
    incomingTotal: all.filter((node) => node.dir !== "out").length,
    outgoingTotal: all.filter((node) => node.dir !== "in").length,
    incoming,
    outgoing,
    shown,
    offBoardIds: off.map((node) => node.blockId),
  };
}

/**
 * Journal first, then whiteboard, then alias/tag, else a plain note.
 * Unknown or missing blocks always become `note` — never throws.
 */
export function relationKind(block: Block | undefined): RelationKind {
  if (journalDateKey(block) != null) return "journal";
  if (isWhiteboardBlock(block)) return "whiteboard";
  if (firstAlias(block) != null) return "tag";
  return "note";
}

export function relationKindIcon(kind: RelationKind): string {
  if (kind === "journal") return "ti ti-calendar";
  if (kind === "whiteboard") return "ti ti-layout-board";
  if (kind === "tag") return "ti ti-tag";
  return "ti ti-file-text";
}

export function relationTitle(
  blockId: DbId,
  blocks: { [id: number]: Block | undefined },
): string {
  const block = blocks[blockId];
  const alias = firstAlias(block);
  if (alias != null) return alias;
  const dateKey = journalDateKey(block);
  if (dateKey != null) return formatCardTitle(dateKey);
  const text = typeof block?.text === "string" ? block.text.trim() : "";
  if (text !== "") {
    const line = text.split("\n")[0]?.trim() ?? "";
    if (line !== "") return line;
  }
  return "";
}

export function clipRelationSnippet(
  text: string | undefined,
  max = RELATION_SNIPPET_MAX,
): string {
  const raw = (text ?? "").replace(/\s+/g, " ").trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max).trimEnd()}…`;
}

export function relationSnippet(
  node: RelationNode,
  section: "in" | "out",
  blocks: { [id: number]: Block | undefined },
): string {
  const id = section === "in" ? node.inSnippetId : node.outSnippetId;
  if (id == null) return "";
  const text = blocks[id]?.text;
  return clipRelationSnippet(typeof text === "string" ? text : undefined);
}

export function relationFetchIds(model: RelationMapModel): DbId[] {
  const ids = new Set<DbId>(model.offBoardIds);
  for (const node of model.shown) {
    ids.add(node.blockId);
    if (node.inSnippetId != null) ids.add(node.inSnippetId);
    if (node.outSnippetId != null) ids.add(node.outSnippetId);
  }
  return [...ids];
}

export function relationMapWatchIds(
  rootId: DbId,
  blocks: { [id: number]: Block | undefined },
): DbId[] {
  const { owner } = buildOwnerMap([stubCard(rootId)], blocks);
  return [...owner.keys()].sort((a, b) => a - b);
}

export function relationMapFingerprint(
  rootId: DbId,
  cardIds: readonly DbId[],
  blocks: { [id: number]: Block | undefined },
): string {
  const watchIds = relationMapWatchIds(rootId, blocks);
  const parts: string[] = [cardIds.join(",")];
  for (const id of watchIds) {
    const block = blocks[id];
    const children = block?.children?.join(",") ?? "";
    const pluginPropIds = readEdgeLinkPropIds(block);
    const refs = (block?.refs ?? [])
      .filter((ref) => keepRelationRef(ref, block))
      .map((ref) => `o${ref.type}:${ref.to}:${ref.id}`)
      .join(",");
    const backs = (block?.backRefs ?? [])
      .filter((ref) => keepRelationRef(ref, blocks[ref.from]))
      .map((ref) => `i${ref.type}:${ref.from}:${ref.id}`)
      .join(",");
    parts.push(`${id}:${children}:${refs}:${backs}:${pluginPropIds.join(",")}`);
  }
  return parts.join("|");
}
