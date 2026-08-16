import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n.ts";
import type { WhiteboardCard } from "./cards.ts";
import {
  planTagToBoardCards,
  TAG_TO_BOARD_COLUMNS,
  TAG_TO_BOARD_LIMIT,
  type TagToBoardPlan,
} from "./tagToBoard.ts";

/** Same cap as tag-to-board so a broad query cannot flood a board. */
export const QUERY_TO_BOARD_LIMIT = TAG_TO_BOARD_LIMIT;
export const QUERY_TO_BOARD_COLUMNS = TAG_TO_BOARD_COLUMNS;

const REPR_PROP = "_repr";
const QUERY_BLOCK_TYPES = new Set(["query", "query2"]);

export type QueryToBoardPlan = TagToBoardPlan;

export type QueryDescriptionLike = {
  q?: unknown;
  sort?: unknown;
  excludeId?: unknown;
  tagName?: unknown;
};

type BlockPropsLike = {
  id?: DbId;
  properties?: readonly { name: string; value?: unknown }[];
} | null | undefined;

function blockRepr(block: BlockPropsLike): Record<string, unknown> | null {
  const value = block?.properties?.find((item) => item.name === REPR_PROP)
    ?.value;
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asBlockId(value: unknown): DbId | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

export function isQueryBlock(block: BlockPropsLike): boolean {
  const type = blockRepr(block)?.type;
  return typeof type === "string" && QUERY_BLOCK_TYPES.has(type);
}

/**
 * Host stores the live query on `_repr.q`. That value is either a
 * QueryDescription (`{ q, sort, … }`) or the query group itself.
 */
export function queryDescriptionFromBlock(
  block: BlockPropsLike,
): QueryDescriptionLike | null {
  if (!isQueryBlock(block)) return null;
  const raw = blockRepr(block)?.q;
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  if (rec.q != null && typeof rec.q === "object" && !Array.isArray(rec.q)) {
    return rec as QueryDescriptionLike;
  }
  if (typeof rec.kind === "number") {
    return { q: rec };
  }
  return null;
}

export function hasQueryGroup(desc: QueryDescriptionLike | null): boolean {
  if (desc == null) return false;
  const group = desc.q;
  if (group == null || typeof group !== "object" || Array.isArray(group)) {
    return false;
  }
  return typeof (group as { kind?: unknown }).kind === "number";
}

/** Fields the backend query accepts; drop view-only table/calendar/stats. */
export function queryBackendPayload(
  desc: QueryDescriptionLike,
  sourceId: DbId,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    q: desc.q,
    pageSize: -1,
  };
  if (desc.sort != null) payload.sort = desc.sort;
  if (typeof desc.tagName === "string" && desc.tagName.trim()) {
    payload.tagName = desc.tagName;
  }
  const exclude = asBlockId(desc.excludeId);
  payload.excludeId = exclude ?? sourceId;
  return payload;
}

/** Pull block ids out of `query` whether it returns ids, blocks, or table rows. */
export function collectQueryResultIds(result: unknown): DbId[] {
  if (result == null) return [];
  if (!Array.isArray(result)) {
    console.error("[whiteboard] query did not return an array", result);
    throw new Error(t("Failed to spread query results onto the board"));
  }
  const ids: DbId[] = [];
  for (const item of result) {
    const id = idFromQueryItem(item);
    if (id != null) ids.push(id);
  }
  if (result.length > 0 && ids.length === 0) {
    console.error("[whiteboard] query returned an unexpected shape", result);
    throw new Error(t("Failed to spread query results onto the board"));
  }
  return ids;
}

function idFromQueryItem(item: unknown): DbId | null {
  const direct = asBlockId(item);
  if (direct != null) return direct;
  if (item == null || typeof item !== "object") return null;
  const rec = item as { id?: unknown; _block?: unknown };
  return asBlockId(rec.id) ?? asBlockId(rec._block);
}

/**
 * Decide which query hits become new cards. Reuses tag-to-board planning:
 * pointers only, skip ids already on the board, cap, grid below existing cards.
 */
export function planQueryToBoardCards(input: {
  blockIds: readonly DbId[];
  existing: readonly WhiteboardCard[];
  limit: number;
  boardBlockId?: DbId;
}): QueryToBoardPlan {
  return planTagToBoardCards(input);
}

export function queryToBoardMessage(plan: QueryToBoardPlan): string {
  if (plan.sourceCount === 0) return t("This query has no results");
  const parts: string[] = [];
  if (plan.added > 0) {
    parts.push(t("Added ${added} cards", { added: String(plan.added) }));
  }
  if (plan.skippedExisting > 0) {
    parts.push(
      t("skipped ${existing} already on the board", {
        existing: String(plan.skippedExisting),
      }),
    );
  }
  if (plan.skippedSelf > 0) {
    parts.push(
      t("skipped ${self} that would nest this board", {
        self: String(plan.skippedSelf),
      }),
    );
  }
  if (plan.truncated > 0) {
    parts.push(
      t("only the first ${limit} notes were placed", {
        limit: String(plan.limit),
      }),
    );
  }
  if (parts.length === 0) return t("Nothing to add to the board");
  return parts.join(t(", "));
}
