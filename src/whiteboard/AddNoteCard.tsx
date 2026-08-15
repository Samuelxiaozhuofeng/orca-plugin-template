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

async function searchNotes(keyword: string): Promise<Block[]> {
  const found = (await orca.invokeBackend(
    "search-blocks-by-text",
    keyword,
  )) as Block[] | null;
  if (!Array.isArray(found)) return [];
  return found.slice(0, MAX_RESULTS);
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
