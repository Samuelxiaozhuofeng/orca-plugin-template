import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { BoardPicker, type BoardPickerRow } from "./BoardPicker";
import { fetchWhiteboardBlocks, listBoards } from "./boards";
import { openBoard } from "./data";

const { useEffect, useState } = window.React;

let hostListener: ((open: boolean) => void) | null = null;
let queued = false;

export function openBoardPicker(): void {
  if (hostListener != null) {
    hostListener(true);
    return;
  }
  queued = true;
}

function OpenBoardDialog(props: { onClose: () => void }): React.ReactNode {
  const [boards, setBoards] = useState<BoardPickerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBoards(null);
    setError(null);
    void fetchWhiteboardBlocks()
      .then((blocks) => {
        if (cancelled) return;
        setBoards(
          listBoards(blocks).map((board) => ({
            id: board.id,
            name: board.name,
            meta: t("${count} cards", { count: String(board.cardCount) }),
          })),
        );
      })
      .catch((err: unknown) => {
        console.error("[whiteboard] failed to list whiteboards", err);
        if (!cancelled) {
          setError(t("Failed to list whiteboards"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <BoardPicker
      title={t("Open whiteboard…")}
      emptyHint={t(
        "No whiteboards yet. In a note, type / and pick New whiteboard (stays in this note) or New whiteboard page (its own page).",
      )}
      error={error}
      items={error != null ? [] : boards}
      onClose={props.onClose}
      onPick={(boardId: DbId) => {
        props.onClose();
        openBoard(boardId, orca.state.activePanel, false);
      }}
    />
  );
}

function OpenBoardHost(): React.ReactNode {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    hostListener = (next) => setOpen(next);
    if (queued) {
      queued = false;
      setOpen(true);
    }
    return () => {
      hostListener = null;
    };
  }, []);

  if (!open) return null;
  return <OpenBoardDialog onClose={() => setOpen(false)} />;
}

export function mountOpenBoardHost(): () => void {
  const el = document.createElement("div");
  el.className = "owb-open-board-host";
  document.body.appendChild(el);
  const root = window.createRoot(el);
  root.render(<OpenBoardHost />);
  return () => {
    root.unmount();
    el.remove();
  };
}
