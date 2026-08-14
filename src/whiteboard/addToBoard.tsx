import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { fetchBlock } from "./newCard";
import {
  dropMessage,
  originBelowCards,
  placeDroppedBlocks,
  type DropBlocksResult,
} from "./dropBlocks";
import { openBoard, readCards, writeCards } from "./data";
import {
  fetchWhiteboardBlocks,
  getOpenBoard,
  listBoards,
  type BoardListItem,
} from "./boards";

const { useEffect, useMemo, useState } = window.React;

const ADD_COMMAND = "addToWhiteboard";

export function addToBoardCommandId(pluginName: string): string {
  return `${pluginName}.${ADD_COMMAND}`;
}

export function AddToBoardMenuItem(props: {
  blockIds: DbId[];
  close: () => void;
}): React.ReactNode {
  return (
    <orca.components.MenuText
      title={t("Add to whiteboard…")}
      preIcon="ti ti-chalkboard"
      onClick={() => {
        props.close();
        openAddToBoard(props.blockIds);
      }}
    />
  );
}

type Request = { ids: DbId[] };

let hostListener: ((req: Request) => void) | null = null;
const queued: Request[] = [];

export function openAddToBoard(ids: DbId[]): void {
  const req = { ids: [...ids] };
  if (hostListener != null) {
    hostListener(req);
    return;
  }
  queued.push(req);
}

async function addBlocksToBoard(
  boardId: DbId,
  ids: readonly DbId[],
): Promise<DropBlocksResult> {
  let block = orca.state.blocks[boardId];
  if (block == null) block = await fetchBlock(boardId);
  const live = getOpenBoard(boardId);
  const existing = live != null ? live.getCards() : readCards(block);
  const result = await placeDroppedBlocks({
    ids,
    at: originBelowCards(existing),
    existing,
    boardBlockId: boardId,
  });
  if (result.added === 0) return result;
  if (live != null) {
    const saved = await live.appendCards(result.incoming);
    if (!saved) {
      throw new Error(t("Failed to add blocks to the board"));
    }
    return result;
  }
  await writeCards(boardId, result.cards);
  return result;
}

function AddToBoardDialog(props: {
  ids: DbId[];
  onClose: () => void;
}): React.ReactNode {
  const [query, setQuery] = useState("");
  const [boards, setBoards] = useState<BoardListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<DbId | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBoards(null);
    setError(null);
    void fetchWhiteboardBlocks()
      .then((blocks) => {
        if (!cancelled) setBoards(listBoards(blocks));
      })
      .catch((err: unknown) => {
        console.error("[whiteboard] failed to list whiteboards", err);
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t("Failed to list whiteboards"),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (boards == null) return [];
    const needle = query.trim().toLowerCase();
    if (needle === "") return boards;
    return boards.filter((board: BoardListItem) =>
      board.name.toLowerCase().includes(needle),
    );
  }, [boards, query]);

  const pick = async (boardId: DbId) => {
    if (busyId != null) return;
    setBusyId(boardId);
    try {
      const result = await addBlocksToBoard(boardId, props.ids);
      props.onClose();
      const open = () => openBoard(boardId, orca.state.activePanel, false);
      orca.notify(
        result.added > 0 ? "success" : "info",
        dropMessage(result),
        { title: t("Open whiteboard"), action: open },
      );
    } catch (err: unknown) {
      console.error("[whiteboard] add to board failed", err);
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
    <orca.components.ModalOverlay visible canClose onClose={props.onClose}>
      <div className="owb-dialog" role="dialog">
        <div className="owb-dialog-title">{t("Add to whiteboard…")}</div>
        <input
          className="owb-board-search"
          type="search"
          value={query}
          autoFocus
          placeholder={t("Search whiteboards")}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setQuery(event.target.value)
          }
        />
        {error != null ? (
          <div className="owb-dialog-warn">{error}</div>
        ) : boards == null ? (
          <div className="owb-dialog-hint">{t("Loading whiteboards…")}</div>
        ) : boards.length === 0 ? (
          <div className="owb-dialog-hint">
            {t(
              "No whiteboards yet. Use the slash command to create one in a note.",
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="owb-dialog-hint">{t("No matching whiteboards")}</div>
        ) : (
          <div className="owb-board-list">
            {filtered.map((board: BoardListItem) => (
              <button
                key={board.id}
                type="button"
                className="owb-board-item"
                disabled={busyId != null}
                onClick={() => void pick(board.id)}
              >
                <span className="owb-board-item-name">{board.name}</span>
                <span className="owb-board-item-count">
                  {t("${count} cards", { count: String(board.cardCount) })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </orca.components.ModalOverlay>
  );
}

function AddToBoardHost(): React.ReactNode {
  const [req, setReq] = useState<Request | null>(null);

  useEffect(() => {
    hostListener = (next) => setReq(next);
    if (queued.length > 0) setReq(queued.shift() ?? null);
    return () => {
      hostListener = null;
    };
  }, []);

  if (req == null) return null;
  return (
    <AddToBoardDialog ids={req.ids} onClose={() => setReq(null)} />
  );
}

export function mountAddToBoardHost(): () => void {
  const el = document.createElement("div");
  el.className = "owb-add-to-board-host";
  document.body.appendChild(el);
  const root = window.createRoot(el);
  root.render(<AddToBoardHost />);
  return () => {
    root.unmount();
    el.remove();
  };
}
