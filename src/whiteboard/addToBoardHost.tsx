import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  addBlocksToBoard,
  boardOpenAction,
  spreadQueryOntoBoard,
  spreadTagOntoBoard,
} from "./addToBoardApply";
import { BoardPicker, type BoardPickerRow } from "./BoardPicker";
import { fetchWhiteboardBlocks, listBoards } from "./boards";
import { dropMessage } from "./dropBlocks";
import { queryToBoardMessage } from "./queryToBoard";
import { tagToBoardMessage } from "./tagToBoard";

const { useEffect, useMemo, useState } = window.React;

type HostRequest =
  | { kind: "add"; ids: DbId[] }
  | { kind: "locate"; hits: LocateHit[] }
  | { kind: "tag"; tagBlock: Block }
  | { kind: "query"; blockId: DbId };

export type LocateHit = {
  boardId: DbId;
  name: string;
  cardBlockId: DbId;
  viaAncestor: boolean;
};

let hostListener: ((req: HostRequest) => void) | null = null;
const queued: HostRequest[] = [];

function dispatchHost(req: HostRequest): void {
  if (hostListener != null) {
    hostListener(req);
    return;
  }
  queued.push(req);
}

export function openAddToBoard(ids: DbId[]): void {
  dispatchHost({ kind: "add", ids: [...ids] });
}

export function openTagToBoard(tagBlock: Block): void {
  dispatchHost({ kind: "tag", tagBlock });
}

export function openQueryToBoard(blockId: DbId): void {
  dispatchHost({ kind: "query", blockId });
}

export function openLocatePicker(hits: LocateHit[]): void {
  dispatchHost({ kind: "locate", hits });
}

function WhiteboardPicker(props: {
  title: string;
  failMessage: string;
  onClose: () => void;
  onPick: (boardId: DbId) => Promise<void>;
}): React.ReactNode {
  const [boards, setBoards] = useState<BoardPickerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<DbId | null>(null);

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

  const pick = async (boardId: DbId) => {
    if (busyId != null) return;
    setBusyId(boardId);
    try {
      await props.onPick(boardId);
    } catch (err: unknown) {
      console.error("[whiteboard] add to board failed", err);
      orca.notify("error", props.failMessage);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <BoardPicker
      title={props.title}
      emptyHint={t(
        "No whiteboards yet. Use the slash command to create one in a note.",
      )}
      error={error}
      items={error != null ? [] : boards}
      busyId={busyId}
      onClose={props.onClose}
      onPick={(boardId) => void pick(boardId)}
    />
  );
}

function AddToBoardDialog(props: {
  ids: DbId[];
  onClose: () => void;
}): React.ReactNode {
  return (
    <WhiteboardPicker
      title={t("Add to whiteboard…")}
      failMessage={t("Failed to add blocks to the board")}
      onClose={props.onClose}
      onPick={async (boardId) => {
        const result = await addBlocksToBoard(boardId, props.ids);
        if (result.refused) return;
        props.onClose();
        orca.notify(
          result.added > 0 ? "success" : "info",
          dropMessage(result),
          { title: t("Open whiteboard"), action: boardOpenAction(boardId) },
        );
      }}
    />
  );
}

function TagToBoardDialog(props: {
  tagBlock: Block;
  onClose: () => void;
}): React.ReactNode {
  return (
    <WhiteboardPicker
      title={t("Spread onto whiteboard…")}
      failMessage={t("Failed to spread tagged notes onto the board")}
      onClose={props.onClose}
      onPick={async (boardId) => {
        const plan = await spreadTagOntoBoard(boardId, props.tagBlock);
        if (plan.refused) return;
        props.onClose();
        orca.notify(
          plan.added > 0 ? "success" : "info",
          tagToBoardMessage(plan),
          { title: t("Open whiteboard"), action: boardOpenAction(boardId) },
        );
      }}
    />
  );
}

function QueryToBoardDialog(props: {
  blockId: DbId;
  onClose: () => void;
}): React.ReactNode {
  return (
    <WhiteboardPicker
      title={t("Spread onto whiteboard…")}
      failMessage={t("Failed to spread query results onto the board")}
      onClose={props.onClose}
      onPick={async (boardId) => {
        const plan = await spreadQueryOntoBoard(boardId, props.blockId);
        if (plan.refused) return;
        props.onClose();
        orca.notify(
          plan.added > 0 ? "success" : "info",
          queryToBoardMessage(plan),
          { title: t("Open whiteboard"), action: boardOpenAction(boardId) },
        );
      }}
    />
  );
}

function LocateBoardDialog(props: {
  hits: LocateHit[];
  onClose: () => void;
  onJump: (boardId: DbId, cardBlockId: DbId) => void;
}): React.ReactNode {
  const items = useMemo(
    () =>
      props.hits.map((hit) => ({
        id: hit.boardId,
        name: hit.name,
        meta: hit.viaAncestor ? t("Inside a card") : t("On this board"),
      })),
    [props.hits],
  );

  return (
    <BoardPicker
      title={t("Locate on whiteboard")}
      emptyHint={t("This block is not on any whiteboard yet")}
      error={null}
      items={items}
      onClose={props.onClose}
      onPick={(boardId) => {
        const hit = props.hits.find((item) => item.boardId === boardId);
        props.onClose();
        if (hit == null) return;
        props.onJump(hit.boardId, hit.cardBlockId);
      }}
    />
  );
}

function AddToBoardHost(props: {
  onJump: (boardId: DbId, cardBlockId: DbId) => void;
}): React.ReactNode {
  const [req, setReq] = useState<HostRequest | null>(null);

  useEffect(() => {
    hostListener = (next) => setReq(next);
    if (queued.length > 0) setReq(queued.shift() ?? null);
    return () => {
      hostListener = null;
    };
  }, []);

  if (req == null) return null;
  if (req.kind === "locate") {
    return (
      <LocateBoardDialog
        hits={req.hits}
        onClose={() => setReq(null)}
        onJump={props.onJump}
      />
    );
  }
  if (req.kind === "tag") {
    return (
      <TagToBoardDialog tagBlock={req.tagBlock} onClose={() => setReq(null)} />
    );
  }
  if (req.kind === "query") {
    return (
      <QueryToBoardDialog blockId={req.blockId} onClose={() => setReq(null)} />
    );
  }
  return <AddToBoardDialog ids={req.ids} onClose={() => setReq(null)} />;
}

export function mountAddToBoardHost(opts: {
  onJump: (boardId: DbId, cardBlockId: DbId) => void;
}): () => void {
  const el = document.createElement("div");
  el.className = "owb-add-to-board-host";
  document.body.appendChild(el);
  const root = window.createRoot(el);
  root.render(<AddToBoardHost onJump={opts.onJump} />);
  return () => {
    root.unmount();
    el.remove();
  };
}
