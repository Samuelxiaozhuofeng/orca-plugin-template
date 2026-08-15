import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n.ts";
import { operableCards } from "./areaChrome.ts";
import type { WhiteboardArea } from "./areas.ts";
import {
  collectBlockIds,
  mapSearchHitsToCardIds,
} from "./cardSearch.ts";

export type CardFilterQuery = {
  tags: string[];
};

export function normalizeTagName(raw: string): string {
  return raw.trim().replace(/^#+/, "").trim();
}

export function uniqueTagNames(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const name = normalizeTagName(item);
    if (name === "") continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function filterIsActive(query: CardFilterQuery): boolean {
  return uniqueTagNames(query.tags).length > 0;
}

/** Cards that stay fully visible. Empty query → every card matches. */
export function matchedCardIds(
  cardIds: ReadonlySet<DbId>,
  query: CardFilterQuery,
  taggedHits: readonly DbId[],
  parentOf: (id: DbId) => DbId | null | undefined,
): Set<DbId> {
  if (!filterIsActive(query)) return new Set(cardIds);
  return new Set(mapSearchHitsToCardIds(cardIds, taggedHits, parentOf));
}

/**
 * Cards that stay on screen but must not be operable.
 * Unknown / untagged cards are treated as unmatched so a filter
 * never highlights a card we could not verify.
 */
export function unmatchedCardIds(
  cardIds: readonly DbId[],
  matched: ReadonlySet<DbId>,
  active: boolean,
): Set<DbId> {
  const hidden = new Set<DbId>();
  if (!active) return hidden;
  for (const id of cardIds) {
    if (!matched.has(id)) hidden.add(id);
  }
  return hidden;
}

/** Collapse hide ∪ tag-filter hide — the one operable-card pipeline. */
export function operableCardsForView<
  C extends {
    blockId: DbId;
    x: number;
    y: number;
    w: number;
    h: number;
  },
>(
  areas: ReadonlyArray<WhiteboardArea>,
  cards: readonly C[],
  filterHidden: ReadonlySet<DbId> | null | undefined,
): C[] {
  return operableCards(areas, cards, filterHidden);
}

export function formatFilterStatus(opts: {
  tags: readonly string[];
  matched: number;
  total: number;
}): string {
  const labels = uniqueTagNames(opts.tags).map((name) => `#${name}`);
  return t("Filtering: ${tags} (${matched} / ${total} cards)", {
    tags: labels.join(t(", ")),
    matched: String(opts.matched),
    total: String(opts.total),
  });
}

export function parentMapFromTaggedResult(
  result: unknown,
): Map<DbId, DbId> {
  const map = new Map<DbId, DbId>();
  if (!Array.isArray(result)) return map;
  for (const item of result) {
    if (item == null || typeof item !== "object") continue;
    const rec = item as { id?: unknown; parent?: unknown };
    if (typeof rec.id !== "number") continue;
    if (typeof rec.parent === "number") map.set(rec.id, rec.parent);
  }
  return map;
}

export function collectTaggedHits(results: readonly unknown[]): {
  ids: DbId[];
  parents: Map<DbId, DbId>;
} {
  const ids: DbId[] = [];
  const seen = new Set<DbId>();
  const parents = new Map<DbId, DbId>();
  for (const result of results) {
    for (const [id, parent] of parentMapFromTaggedResult(result)) {
      parents.set(id, parent);
    }
    for (const id of collectBlockIds(result)) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return { ids, parents };
}

export function paintFilterDim(
  canvas: HTMLElement | null,
  dimmed: ReadonlySet<DbId> | null,
): void {
  if (canvas == null) return;
  const cards = canvas.querySelectorAll<HTMLElement>(".owb-card");
  for (const card of cards) {
    const raw = card.dataset.blockId;
    const id = raw == null ? Number.NaN : Number(raw);
    const fade = dimmed != null && Number.isFinite(id) && dimmed.has(id);
    card.classList.toggle("is-filter-dim", fade);
  }
}
