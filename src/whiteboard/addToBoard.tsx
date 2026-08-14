import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { BoardPicker, type BoardPickerRow } from "./BoardPicker";
import {
  fetchWhiteboardBlocks,
  findBoardsContainingBlock,
  findOpenBoardPanelId,
  getOpenBoard,
  listBoards,
  type BoardLocateHit,
} from "./boards";
import { requestCardFocus } from "./cardFocus";
import { openBoard, PANEL_TYPE, readCards, writeCards } from "./data";
import {
  dropMessage,
  originBelowCards,
  placeDroppedBlocks,
  type DropBlocksResult,
} from "./dropBlocks";
import { fetchBlock } from "./newCard";

const { useEffect, useMemo, useState } = window.React;

const ADD_COMMAND = "addToWhiteboard";
const LOCATE_COMMAND = "locateOnWhiteboard";

export function addToBoardCommandId(pluginName: string): string {
  return `${pluginName}.${ADD_COMMAND}`;
}

export function locateOnBoardCommandId(pluginName: string): string {
  return `${pluginName}.${LOCATE_COMMAND}`;
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

export function LocateOnBoardMenuItem(props: {
  blockId: DbId;
  close: () => void;
}): React.ReactNode {
  return (
    <orca.components.MenuText
      title={t("Locate on whiteboard")}
      preIcon="ti ti-focus-2"
      onClick={() => {
        props.close();
        void locateBlockOnWhiteboard(props.blockId);
      }}
    />
  );
}

type HostRequest =
  | { kind: "add"; ids: DbId[] }
  | { kind: "locate"; hits: BoardLocateHit[] };

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

function openLocatePicker(hits: BoardLocateHit[]): void {
  dispatchHost({ kind: "locate", hits });
}

export function jumpToBoardCard(boardId: DbId, cardBlockId: DbId): void {
  requestCardFocus(boardId, cardBlockId);
  const openId = findOpenBoardPanelId(orca.state.panels, boardId);
  if (openId != null) {
    orca.nav.switchFocusTo(openId);
    return;
  }
  orca.nav.openInLastPanel(PANEL_TYPE, { blockId: boardId });
}

export async function locateBlockOnWhiteboard(blockId: DbId): Promise<void> {
  try {
    const hits = await findBoardsContainingBlock(blockId);
    if (hits.length === 0) {
      orca.notify("info", t("This block is not on any whiteboard yet"), {
        title: t("Add to whiteboard…"),
        action: () => openAddToBoard([blockId]),
      });
      return;
    }
    if (hits.length === 1) {
      jumpToBoardCard(hits[0].boardId, hits[0].cardBlockId);
      return;
    }
    openLocatePicker(hits);
  } catch (err: unknown) {
    console.error("[whiteboard] locate on whiteboard failed", err);
    orca.notify(
      "error",
      err instanceof Error
        ? err.message
        : t("Failed to find this block on whiteboards"),
    );
  }
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
          setError(
            err instanceof Error ? err.message : t("Failed to list whiteboards"),
          );
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
    <BoardPicker
      title={t("Add to whiteboard…")}
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

function LocateBoardDialog(props: {
  hits: BoardLocateHit[];
  onClose: () => void;
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
        jumpToBoardCard(hit.boardId, hit.cardBlockId);
      }}
    />
  );
}

function AddToBoardHost(): React.ReactNode {
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
    return <LocateBoardDialog hits={req.hits} onClose={() => setReq(null)} />;
  }
  return <AddToBoardDialog ids={req.ids} onClose={() => setReq(null)} />;
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
