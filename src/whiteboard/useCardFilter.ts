import type { DbId } from "../orca.d.ts";
import {
  collectTaggedHits,
  filterIsActive,
  matchedCardIds,
  normalizeTagName,
  uniqueTagNames,
  unmatchedCardIds,
  type CardFilterQuery,
} from "./cardFilter";
import type { WhiteboardCard } from "./data";

const { useCallback, useEffect, useMemo, useRef, useState } = window.React;

const TAG_SEARCH_MS = 180;
const TAG_SEARCH_LIMIT = 40;

export type CardFilterApi = {
  query: CardFilterQuery;
  open: boolean;
  active: boolean;
  matched: ReadonlySet<DbId>;
  unmatched: ReadonlySet<DbId>;
  matchedCount: number;
  totalCount: number;
  tagHits: string[];
  tagSearch: string;
  searching: boolean;
  setTagSearch: (value: string) => void;
  toggleTag: (name: string) => void;
  setOpen: (open: boolean) => void;
  clear: () => void;
};

type FilterSession = {
  tags: string[];
  open: boolean;
  listeners: Set<() => void>;
};

const sessions = new Map<DbId, FilterSession>();

function getSession(boardId: DbId): FilterSession {
  let session = sessions.get(boardId);
  if (session == null) {
    session = { tags: [], open: false, listeners: new Set() };
    sessions.set(boardId, session);
  }
  return session;
}

function emitSession(session: FilterSession): void {
  for (const fn of session.listeners) fn();
}

function patchSession(
  boardId: DbId,
  patch: Partial<Pick<FilterSession, "tags" | "open">>,
): void {
  const session = getSession(boardId);
  if (patch.tags != null) session.tags = patch.tags;
  if (patch.open != null) session.open = patch.open;
  emitSession(session);
}

function subscribeSession(boardId: DbId, fn: () => void): () => void {
  const session = getSession(boardId);
  session.listeners.add(fn);
  return () => {
    session.listeners.delete(fn);
    if (session.listeners.size === 0) sessions.delete(boardId);
  };
}

function aliasNames(result: unknown): string[] {
  if (!Array.isArray(result)) return [];
  const names: string[] = [];
  for (const item of result) {
    if (typeof item === "string" && item !== "") {
      names.push(item);
      continue;
    }
    if (item == null || typeof item !== "object") continue;
    const record = item as { name?: unknown; alias?: unknown };
    const name =
      typeof record.name === "string"
        ? record.name
        : typeof record.alias === "string"
          ? record.alias
          : "";
    if (name !== "") names.push(name);
  }
  return uniqueTagNames(names);
}

function liveParent(id: DbId): DbId | null {
  const block = orca.state.blocks[id];
  return typeof block?.parent === "number" ? block.parent : null;
}

export function useCardFilterControls(boardBlockId: DbId): {
  tags: string[];
  open: boolean;
  active: boolean;
  tagHits: string[];
  tagSearch: string;
  searching: boolean;
  setTagSearch: (value: string) => void;
  toggleTag: (name: string) => void;
  setOpen: (open: boolean) => void;
  clear: () => void;
} {
  const session = useFilterSession(boardBlockId);
  const [tagSearch, setTagSearch] = useState("");
  const [tagHits, setTagHits] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const searchGenRef = useRef(0);

  useEffect(() => {
    const keyword = tagSearch.trim();
    const run = ++searchGenRef.current;
    if (keyword === "") {
      setTagHits(uniqueTagNames(session.tags));
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      void orca
        .invokeBackend("search-aliases", keyword)
        .then((result: unknown) => {
          if (run !== searchGenRef.current) return;
          const found = aliasNames(result).slice(0, TAG_SEARCH_LIMIT);
          const selected = uniqueTagNames(session.tags);
          const extra = selected.filter(
            (name) =>
              !found.some((hit) => hit.toLowerCase() === name.toLowerCase()) &&
              name.toLowerCase().includes(keyword.toLowerCase()),
          );
          setTagHits([...extra, ...found]);
          setSearching(false);
        })
        .catch(() => {
          if (run !== searchGenRef.current) return;
          setTagHits(uniqueTagNames(session.tags));
          setSearching(false);
        });
    }, TAG_SEARCH_MS);
    return () => window.clearTimeout(timer);
  }, [session.tags, tagSearch]);

  const toggleTag = useCallback(
    (name: string) => {
      const next = normalizeTagName(name);
      if (next === "") return;
      const key = next.toLowerCase();
      const exists = session.tags.some(
        (item) => normalizeTagName(item).toLowerCase() === key,
      );
      session.setTags(
        exists
          ? session.tags.filter(
              (item) => normalizeTagName(item).toLowerCase() !== key,
            )
          : uniqueTagNames([...session.tags, next]),
      );
    },
    [session],
  );

  const clear = useCallback(() => {
    session.setTags([]);
    setTagSearch("");
    session.setOpen(false);
  }, [session]);

  return {
    tags: session.tags,
    open: session.open,
    active: filterIsActive({ tags: session.tags }),
    tagHits,
    tagSearch,
    searching,
    setTagSearch,
    toggleTag,
    setOpen: session.setOpen,
    clear,
  };
}

function useFilterSession(boardBlockId: DbId): {
  tags: string[];
  open: boolean;
  setTags: (tags: string[]) => void;
  setOpen: (open: boolean) => void;
} {
  const [, bump] = useState(0);
  useEffect(
    () => subscribeSession(boardBlockId, () => bump((n: number) => n + 1)),
    [boardBlockId],
  );
  const session = getSession(boardBlockId);
  const setTags = useCallback(
    (next: string[]) => patchSession(boardBlockId, { tags: next }),
    [boardBlockId],
  );
  const setOpen = useCallback(
    (next: boolean) => patchSession(boardBlockId, { open: next }),
    [boardBlockId],
  );
  return {
    tags: session.tags,
    open: session.open,
    setTags,
    setOpen,
  };
}

export function useCardFilter(
  boardBlockId: DbId,
  cards: readonly WhiteboardCard[],
): Pick<
  CardFilterApi,
  | "query"
  | "open"
  | "active"
  | "matched"
  | "unmatched"
  | "matchedCount"
  | "totalCount"
  | "clear"
> {
  const { tags, open, setTags, setOpen } = useFilterSession(boardBlockId);
  const [taggedIds, setTaggedIds] = useState<DbId[]>([]);
  const parentsRef = useRef(new Map<DbId, DbId>());

  useEffect(() => {
    setTaggedIds([]);
    parentsRef.current = new Map();
  }, [boardBlockId]);

  const query = useMemo<CardFilterQuery>(() => ({ tags }), [tags]);
  const active = filterIsActive(query);

  useEffect(() => {
    if (!active) {
      setTaggedIds([]);
      parentsRef.current = new Map();
      return;
    }
    const names = uniqueTagNames(tags);
    let cancelled = false;
    void Promise.all(
      names.map((name) =>
        orca.invokeBackend("get-blocks-with-tags", [name]).catch(() => []),
      ),
    ).then((results: unknown[]) => {
      if (cancelled) return;
      const collected = collectTaggedHits(results);
      parentsRef.current = collected.parents;
      setTaggedIds(collected.ids);
    });
    return () => {
      cancelled = true;
    };
  }, [active, tags]);

  const cardIdList = useMemo(
    () => cards.map((card) => card.blockId),
    [cards],
  );
  const cardIdSet = useMemo(() => new Set(cardIdList), [cardIdList]);

  const matched = useMemo(
    () =>
      matchedCardIds(cardIdSet, query, taggedIds, (id) => {
        const fromHit = parentsRef.current.get(id);
        if (fromHit != null) return fromHit;
        return liveParent(id);
      }),
    [cardIdSet, query, taggedIds],
  );
  const unmatched = useMemo(
    () => unmatchedCardIds(cardIdList, matched, active),
    [active, cardIdList, matched],
  );

  const clear = useCallback(() => {
    setTags([]);
    setOpen(false);
  }, [setOpen, setTags]);

  return {
    query,
    open,
    active,
    matched,
    unmatched,
    matchedCount: active ? matched.size : cards.length,
    totalCount: cards.length,
    clear,
  };
}
