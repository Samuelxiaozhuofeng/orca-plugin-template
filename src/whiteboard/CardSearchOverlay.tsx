import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { readCardBlockView } from "./blockWatch";
import { blockCardTitle } from "./CardTitle";
import type { WhiteboardCard } from "./data";
import {
  collectBlockIds,
  mapSearchHitsToCardIds,
  matchCardDocs,
  mergeCardSearchHits,
  type CardSearchDoc,
  type CardSearchHit,
} from "./cardSearch";

const { useEffect, useMemo, useRef, useState } = window.React;

const SEARCH_DEBOUNCE_MS = 220;
const MAX_RESULTS = 40;

function aliasNames(result: unknown): string[] {
  if (!Array.isArray(result)) return [];
  const names: string[] = [];
  for (const item of result) {
    if (typeof item === "string" && item !== "") {
      names.push(item);
      continue;
    }
    if (item != null && typeof item === "object") {
      const record = item as { name?: unknown; alias?: unknown };
      const name =
        typeof record.name === "string"
          ? record.name
          : typeof record.alias === "string"
            ? record.alias
            : "";
      if (name !== "") names.push(name);
    }
  }
  return names;
}

function idsFromAliasMap(result: unknown): DbId[] {
  if (result == null || typeof result !== "object") return [];
  if (Array.isArray(result)) return collectBlockIds(result);
  const ids: DbId[] = [];
  for (const value of Object.values(result as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value)) ids.push(value);
  }
  return ids;
}

function parentMapFromResult(result: unknown): Map<DbId, DbId> {
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

function docsFromCards(cards: readonly WhiteboardCard[]): CardSearchDoc[] {
  const blocks = orca.state.blocks as {
    [id: number]: Block | undefined;
  };
  return cards.map((card) => {
    const title =
      card.kind === "journal" && typeof card.date === "string"
        ? card.date
        : blockCardTitle(card.blockId, blocks);
    return {
      blockId: card.blockId,
      title,
      body: readCardBlockView(card.blockId).excerpt,
    };
  });
}

async function searchRemoteCardIds(
  keyword: string,
  cardIds: ReadonlySet<DbId>,
): Promise<DbId[]> {
  let textResult: unknown;
  try {
    textResult = await orca.invokeBackend("search-blocks-by-text", keyword);
  } catch {
    textResult = await orca.invokeBackend("query", {
      q: {
        kind: 1,
        conditions: [{ kind: 8, text: keyword, raw: true }],
      },
      sort: [["_modified", "DESC"]],
      pageSize: MAX_RESULTS,
    });
  }
  const aliases = await orca.invokeBackend("search-aliases", keyword);
  const names = aliasNames(aliases);
  const aliasIds =
    names.length === 0
      ? []
      : idsFromAliasMap(await orca.invokeBackend("get-aliases-ids", names));

  const hitIds = [...collectBlockIds(textResult), ...aliasIds];
  const parents = parentMapFromResult(textResult);
  return mapSearchHitsToCardIds(cardIds, hitIds, (id) => {
    const fromHit = parents.get(id);
    if (fromHit != null) return fromHit;
    const live = orca.state.blocks[id];
    return typeof live?.parent === "number" ? live.parent : null;
  });
}

export function CardSearchOverlay({
  cards,
  onPick,
  onClose,
}: {
  cards: readonly WhiteboardCard[];
  onPick: (cardBlockId: DbId) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [remoteIds, setRemoteIds] = useState<DbId[] | null>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const runIdRef = useRef(0);

  const docs = useMemo(() => docsFromCards(cards), [cards]);
  const cachedHits = useMemo(
    () => matchCardDocs(docs, query),
    [docs, query],
  );
  const hits = useMemo<CardSearchHit[]>(() => {
    const keyword = query.trim();
    if (keyword === "") return [];
    return mergeCardSearchHits(cachedHits, remoteIds ?? [], docs).slice(
      0,
      MAX_RESULTS,
    );
  }, [cachedHits, docs, query, remoteIds]);

  useEffect(() => {
    const el = inputRef.current;
    if (el == null) return;
    el.focus();
    const timer = window.setTimeout(() => el.focus(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const keyword = query.trim();
    if (keyword === "") {
      runIdRef.current += 1;
      setRemoteIds([]);
      return;
    }
    const run = ++runIdRef.current;
    setRemoteIds(null);
    const timer = window.setTimeout(() => {
      const cardIds = new Set(cards.map((card) => card.blockId));
      void searchRemoteCardIds(keyword, cardIds)
        .then((ids) => {
          if (runIdRef.current !== run) return;
          setRemoteIds(ids);
        })
        .catch((err: unknown) => {
          console.error("[whiteboard] card search failed", err);
          if (runIdRef.current !== run) return;
          setRemoteIds([]);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [cards, query]);

  useEffect(() => {
    setActive(0);
  }, [query, hits.length]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>("[data-active='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        if (event.shiftKey || event.altKey) return;
        event.preventDefault();
        event.stopPropagation();
        inputRef.current?.focus();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const pick = (index: number) => {
    const hit = hits[index];
    if (hit == null) return;
    onPick(hit.blockId);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (hits.length === 0) return;
      setActive((i: number) => (i + 1) % hits.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (hits.length === 0) return;
      setActive((i: number) => (i - 1 + hits.length) % hits.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      pick(active);
    }
  };

  const waiting = query.trim() !== "" && remoteIds == null;

  return (
    <div
      className="owb-card-search"
      role="dialog"
      aria-label={t("Search cards")}
      onMouseDown={(event: React.MouseEvent) => event.stopPropagation()}
    >
      <input
        ref={inputRef}
        className="owb-card-search-input"
        type="search"
        value={query}
        autoFocus
        placeholder={t("Search cards")}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          setQuery(event.target.value)
        }
        onKeyDown={onInputKeyDown}
      />
      {query.trim() === "" ? (
        <div className="owb-card-search-hint">
          {t("Type to find cards on this board.")}
        </div>
      ) : hits.length === 0 && !waiting ? (
        <div className="owb-card-search-hint">{t("No matching cards")}</div>
      ) : (
        <div ref={listRef} className="owb-card-search-list" role="listbox">
          {hits.map((hit: CardSearchHit, index: number) => (
            <button
              key={hit.blockId}
              type="button"
              role="option"
              data-active={index === active ? "true" : undefined}
              aria-selected={index === active}
              className={`owb-card-search-item${
                index === active ? " is-active" : ""
              }`}
              onMouseEnter={() => setActive(index)}
              onClick={() => pick(index)}
            >
              <span className="owb-card-search-title">
                {hit.title || t("Untitled")}
              </span>
              {hit.snippet !== "" && hit.snippet !== hit.title ? (
                <span className="owb-card-search-snippet">{hit.snippet}</span>
              ) : null}
            </button>
          ))}
          {waiting ? (
            <div className="owb-card-search-hint">{t("Searching…")}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
