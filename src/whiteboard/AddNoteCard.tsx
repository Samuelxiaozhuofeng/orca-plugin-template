import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import type { WhiteboardCard } from "./cards";
import { placeDroppedBlocks } from "./dropBlocks";

const { useEffect, useMemo, useRef, useState } = window.React;

const SEARCH_DEBOUNCE_MS = 220;
const MAX_RESULTS = 40;
const PREVIEW_CHARS = 120;

type Row = {
  id: DbId;
  label: string;
  onBoard: boolean;
};

/** Blocks carry their plain text on `text`; fall back to the first alias so a
 * result is never a blank row. */
function blockLabel(block: Block): string {
  const text = typeof block.text === "string" ? block.text.trim() : "";
  const source = text !== "" ? text : (block.aliases?.[0] ?? "");
  const flat = source.replace(/\s+/g, " ").trim();
  if (flat === "") return t("Untitled block");
  if (flat.length <= PREVIEW_CHARS) return flat;
  return `${flat.slice(0, PREVIEW_CHARS)}…`;
}

function asBlockId(value: unknown): DbId | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function collectIds(result: unknown): DbId[] {
  if (!Array.isArray(result)) return [];
  const ids: DbId[] = [];
  const seen = new Set<DbId>();
  for (const item of result) {
    const id =
      typeof item === "number"
        ? asBlockId(item)
        : item != null && typeof item === "object" && "id" in item
          ? asBlockId((item as { id: unknown }).id)
          : null;
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

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
  if (Array.isArray(result)) return collectIds(result);
  const ids: DbId[] = [];
  for (const value of Object.values(result as Record<string, unknown>)) {
    const id = asBlockId(value);
    if (id != null) ids.push(id);
  }
  return ids;
}

async function loadBlocks(ids: DbId[]): Promise<Block[]> {
  if (ids.length === 0) return [];
  const fetched =
    ((await orca.invokeBackend("get-blocks", ids)) as Block[] | null) ?? [];
  if (!Array.isArray(fetched)) return [];
  const byId = new Map(fetched.map((block) => [block.id, block]));
  const out: Block[] = [];
  for (const id of ids) {
    const block = byId.get(id);
    if (block == null) continue;
    orca.state.blocks[block.id] = block;
    out.push(block);
  }
  return out;
}

/** Match every block whose body text or page title contains the keyword. */
async function searchNotes(keyword: string): Promise<Block[]> {
  const [textResult, aliases] = await Promise.all([
    orca.invokeBackend("query", {
      q: {
        kind: 1,
        conditions: [{ kind: 8, text: keyword, raw: true }],
      },
      sort: [["_modified", "DESC"]],
      pageSize: MAX_RESULTS,
    }),
    orca.invokeBackend("search-aliases", keyword),
  ]);

  const names = aliasNames(aliases);
  const aliasIds =
    names.length === 0
      ? []
      : idsFromAliasMap(await orca.invokeBackend("get-aliases-ids", names));

  const ids = collectIds(textResult);
  const seen = new Set(ids);
  for (const id of aliasIds) {
    if (ids.length >= MAX_RESULTS) break;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return loadBlocks(ids.slice(0, MAX_RESULTS));
}

type Props = {
  boardBlockId: DbId;
  /** Where the card lands — the point the user right-clicked. */
  at: { x: number; y: number };
  cardsRef: { current: WhiteboardCard[] };
  onAddCards: (cards: WhiteboardCard[]) => Promise<boolean>;
  onFocusCard: (cardBlockId: DbId) => void;
  onClose: () => void;
};

export function AddNoteCard({
  boardBlockId,
  at,
  cardsRef,
  onAddCards,
  onFocusCard,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [blocks, setBlocks] = useState<Block[] | null>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<DbId | null>(null);
  const runIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
      setBlocks([]);
      setError(null);
      return;
    }
    const run = ++runIdRef.current;
    setBlocks(null);
    setError(null);
    const timer = window.setTimeout(() => {
      void searchNotes(keyword)
        .then((found) => {
          if (runIdRef.current !== run) return;
          setBlocks(found);
        })
        .catch((err: unknown) => {
          console.error("[whiteboard] note search failed", err);
          if (runIdRef.current !== run) return;
          setBlocks([]);
          setError(t("Failed to search notes"));
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const rows = useMemo<Row[] | null>(() => {
    if (blocks == null) return null;
    const onBoard = new Set(
      cardsRef.current.map((card: WhiteboardCard) => card.blockId),
    );
    return blocks
      .filter((block: Block) => block.id !== boardBlockId)
      .map((block: Block) => ({
        id: block.id,
        label: blockLabel(block),
        onBoard: onBoard.has(block.id),
      }));
  }, [blocks, boardBlockId, cardsRef]);

  const pick = async (row: Row) => {
    if (busyId != null) return;
    if (row.onBoard) {
      onClose();
      onFocusCard(row.id);
      return;
    }
    setBusyId(row.id);
    try {
      const result = await placeDroppedBlocks({
        ids: [row.id],
        at,
        existing: cardsRef.current,
        boardBlockId,
      });
      if (result.incoming.length === 0) {
        onClose();
        return;
      }
      const saved = await onAddCards(result.incoming);
      if (saved) onClose();
    } catch (err: unknown) {
      console.error("[whiteboard] add note card failed", err);
      orca.notify(
        "error",
        err instanceof Error
          ? err.message
          : t("Failed to add blocks to the board"),
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <orca.components.ModalOverlay visible canClose onClose={onClose}>
      <div
        className="owb-dialog"
        role="dialog"
        onMouseDown={(event: React.MouseEvent) => event.stopPropagation()}
      >
        <div className="owb-dialog-title">{t("Add a note as a card…")}</div>
        <input
          ref={inputRef}
          className="owb-board-search"
          type="search"
          value={query}
          autoFocus
          placeholder={t("Search notes")}
          onMouseDown={(event: React.MouseEvent) => event.stopPropagation()}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setQuery(event.target.value)
          }
        />
        {error != null ? (
          <div className="owb-dialog-warn">{error}</div>
        ) : query.trim() === "" ? (
          <div className="owb-dialog-hint">
            {t("Type to search your notes.")}
          </div>
        ) : rows == null ? (
          <div className="owb-dialog-hint">{t("Searching…")}</div>
        ) : rows.length === 0 ? (
          <div className="owb-dialog-hint">{t("No matching notes")}</div>
        ) : (
          <div className="owb-board-list">
            {rows.map((row: Row) => (
              <button
                key={row.id}
                type="button"
                className="owb-board-item"
                disabled={busyId != null}
                onClick={() => void pick(row)}
              >
                <span className="owb-board-item-name">{row.label}</span>
                <span className="owb-board-item-count">
                  {row.onBoard ? t("Already on this board") : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </orca.components.ModalOverlay>
  );
}
