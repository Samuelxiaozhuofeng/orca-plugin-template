import type { DbId } from "../orca.d.ts";

export type CardSearchDoc = {
  blockId: DbId;
  title: string;
  body: string;
};

export type CardSearchHit = {
  blockId: DbId;
  title: string;
  snippet: string;
  score: number;
};

const PARENT_WALK = 20;
const SNIPPET_CHARS = 80;

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function snippetAround(
  text: string,
  query: string,
  max = SNIPPET_CHARS,
): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed === "") return "";
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max).trimEnd()}…`;
  }
  const lower = trimmed.toLowerCase();
  const at = lower.indexOf(needle);
  if (at < 0) {
    return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max).trimEnd()}…`;
  }
  const start = Math.max(0, at - 16);
  const slice = trimmed.slice(start, start + max);
  return `${start > 0 ? "…" : ""}${slice}${start + max < trimmed.length ? "…" : ""}`;
}

function scoreDoc(doc: CardSearchDoc, query: string): CardSearchHit | null {
  const title = doc.title.toLowerCase();
  const body = doc.body.toLowerCase();
  let score = 0;
  if (title === query) score = 400;
  else if (title.startsWith(query)) score = 300;
  else {
    const titleAt = title.indexOf(query);
    if (titleAt >= 0) score = 200 - Math.min(titleAt, 99);
    else {
      const bodyAt = body.indexOf(query);
      if (bodyAt < 0) return null;
      score = 100 - Math.min(bodyAt, 99);
    }
  }
  const snippet =
    doc.title.toLowerCase().includes(query) && doc.title.trim() !== ""
      ? doc.title.trim()
      : snippetAround(doc.body || doc.title, query);
  return {
    blockId: doc.blockId,
    title: doc.title.trim() === "" ? snippet || doc.title : doc.title,
    snippet,
    score,
  };
}

/** Rank cards whose cached title/body contain `query`. Empty query → no hits. */
export function matchCardDocs(
  docs: readonly CardSearchDoc[],
  query: string,
): CardSearchHit[] {
  const q = normalizeSearchQuery(query);
  if (q === "") return [];
  const hits: CardSearchHit[] = [];
  for (const doc of docs) {
    const hit = scoreDoc(doc, q);
    if (hit != null) hits.push(hit);
  }
  hits.sort(
    (a, b) => b.score - a.score || a.title.localeCompare(b.title),
  );
  return hits;
}

/**
 * Walk each backend hit (and its parents) until it lands on a board card.
 * Does not fetch blocks — `parentOf` only sees what the caller already has.
 */
export function mapSearchHitsToCardIds(
  cardIds: ReadonlySet<DbId>,
  hitIds: readonly DbId[],
  parentOf: (id: DbId) => DbId | null | undefined,
): DbId[] {
  const found = new Set<DbId>();
  const out: DbId[] = [];
  for (const start of hitIds) {
    let id: DbId | null | undefined = start;
    for (let i = 0; i < PARENT_WALK && id != null; i++) {
      if (cardIds.has(id) && !found.has(id)) {
        found.add(id);
        out.push(id);
        break;
      }
      const parent = parentOf(id);
      if (parent == null || parent === id) break;
      id = parent;
    }
  }
  return out;
}

/** Union cache hits with backend-mapped card ids. Backend-only cards score lower. */
export function mergeCardSearchHits(
  cached: readonly CardSearchHit[],
  remoteIds: readonly DbId[],
  docs: readonly CardSearchDoc[],
): CardSearchHit[] {
  const byId = new Map(docs.map((doc) => [doc.blockId, doc]));
  const hits = new Map<DbId, CardSearchHit>();
  for (const hit of cached) hits.set(hit.blockId, hit);
  for (const id of remoteIds) {
    if (hits.has(id)) continue;
    const doc = byId.get(id);
    const title = doc?.title.trim() ?? "";
    const snippet = snippetAround(doc?.body || title, "");
    hits.set(id, {
      blockId: id,
      title,
      snippet,
      score: 50,
    });
  }
  return [...hits.values()].sort(
    (a, b) => b.score - a.score || a.title.localeCompare(b.title),
  );
}

const findByPanel = new Map<string, () => void>();

/** Register this panel's open-search action. Returns an unregister fn. */
export function registerFindCardAction(
  panelId: string,
  open: () => void,
): () => void {
  findByPanel.set(panelId, open);
  return () => {
    if (findByPanel.get(panelId) === open) findByPanel.delete(panelId);
  };
}

/** No-op when the active panel is not a whiteboard that registered. */
export function invokeFindCardOnActivePanel(): void {
  const panelId = orca.state.activePanel;
  if (panelId === "") return;
  findByPanel.get(panelId)?.();
}

export function collectBlockIds(result: unknown): DbId[] {
  if (!Array.isArray(result)) return [];
  const ids: DbId[] = [];
  const seen = new Set<DbId>();
  for (const item of result) {
    const id =
      typeof item === "number" && Number.isFinite(item)
        ? item
        : item != null &&
            typeof item === "object" &&
            "id" in item &&
            typeof (item as { id: unknown }).id === "number"
          ? (item as { id: number }).id
          : null;
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}
