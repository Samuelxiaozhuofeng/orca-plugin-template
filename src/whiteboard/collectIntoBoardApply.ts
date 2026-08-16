import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import type { WhiteboardArea } from "./areas";
import { discardLastRecord, runAsHistoryStep } from "./boardHistory";
import { commitBoardOn } from "./boardPersistCommit";
import {
  getBoardSession,
  notifyBoardNotReady,
  refuseIfProtected,
  writeSessionSnapshot,
} from "./boardSession";
import {
  boardPropsReadable,
  notifyBoardUnreadable,
} from "./boardWrite";
import type { WhiteboardCard } from "./cards";
import { tryReadCards } from "./cards";
import { planCollectIntoBoard } from "./collectIntoBoard";
import { abandonNewSubBoard, createSubBoard } from "./createSubBoard";
import type { WhiteboardEdge } from "./edges";
import { tryReadEdges } from "./edges";
import { blankCardAt } from "./newCard";
import { requestSubBoard } from "./SubBoardDialog";

const collectByPanel = new Map<string, () => void>();
const createdSubBoards = new Set<DbId>();
let applyBusy = false;

function beginApply(): boolean {
  if (applyBusy) return false;
  applyBusy = true;
  return true;
}

function endApply(): void {
  applyBusy = false;
}

export function rememberCreatedSubBoard(id: DbId): void {
  createdSubBoards.add(id);
}

export function takeCreatedSubBoard(id: DbId): boolean {
  if (!createdSubBoards.has(id)) return false;
  createdSubBoards.delete(id);
  return true;
}

/** Delete B only when it is still a freshly created empty shell. */
export async function abandonCreatedSubBoardIfEmpty(id: DbId): Promise<boolean> {
  const block = orca.state.blocks[id];
  const cards = tryReadCards(block);
  const edges = tryReadEdges(block);
  if (!cards.ok || !edges.ok) return false;
  if (cards.value.length > 0 || edges.value.length > 0) return false;
  await abandonNewSubBoard(id);
  return true;
}

export function registerCollectSelectedAction(
  panelId: string,
  run: () => void,
): () => void {
  collectByPanel.set(panelId, run);
  return () => {
    if (collectByPanel.get(panelId) === run) collectByPanel.delete(panelId);
  };
}

export function invokeCollectSelectedOnActivePanel(): void {
  if (applyBusy) return;
  const panelId = orca.state.activePanel;
  if (panelId === "") return;
  collectByPanel.get(panelId)?.();
}

function refuseBoardA(boardId: DbId): boolean {
  const session = getBoardSession(boardId);
  if (session != null && refuseIfProtected(session)) return true;
  if (!boardPropsReadable(orca.state.blocks[boardId])) {
    notifyBoardUnreadable(boardId);
    return true;
  }
  if (session == null) {
    notifyBoardNotReady();
    return true;
  }
  return false;
}

export async function placeNewSubBoardOnBoard(opts: {
  boardBlockId: DbId;
  x: number;
  y: number;
  addCards: (cards: WhiteboardCard[]) => Promise<boolean>;
  selectCards: (ids: DbId[]) => void;
}): Promise<void> {
  if (!beginApply()) return;
  try {
    if (refuseBoardA(opts.boardBlockId)) return;
    const draft = await requestSubBoard();
    if (draft == null) return;
    if (refuseBoardA(opts.boardBlockId)) return;

    const createdId = await createSubBoard({
      name: draft.name,
      kind: draft.kind,
      parentBoardId: opts.boardBlockId,
    });
    if (createdId == null) return;
    rememberCreatedSubBoard(createdId);

    const saved = await opts.addCards([blankCardAt(createdId, opts.x, opts.y)]);
    if (!saved) {
      orca.notify(
        "error",
        t(
          "Created the whiteboard but could not save it as a card. The new whiteboard is still in the notes.",
        ),
      );
      return;
    }
    opts.selectCards([createdId]);
  } finally {
    endApply();
  }
}

export async function collectSelectedIntoBoard(opts: {
  boardBlockId: DbId;
  selectedIds: readonly DbId[];
  cards: readonly WhiteboardCard[];
  edges: readonly WhiteboardEdge[];
  areas: readonly WhiteboardArea[];
  selectCards: (ids: DbId[]) => void;
}): Promise<void> {
  if (!beginApply()) return;
  try {
    await collectSelectedIntoBoardBody(opts);
  } finally {
    endApply();
  }
}

async function collectSelectedIntoBoardBody(opts: {
  boardBlockId: DbId;
  selectedIds: readonly DbId[];
  cards: readonly WhiteboardCard[];
  edges: readonly WhiteboardEdge[];
  areas: readonly WhiteboardArea[];
  selectCards: (ids: DbId[]) => void;
}): Promise<void> {
  if (refuseBoardA(opts.boardBlockId)) return;

  const selected = new Set(opts.selectedIds);
  if (planCollectIntoBoard(opts.cards, opts.edges, selected, -1) == null) {
    return;
  }

  const draft = await requestSubBoard();
  if (draft == null) return;
  if (refuseBoardA(opts.boardBlockId)) return;

  const session = getBoardSession(opts.boardBlockId);
  if (session == null) {
    notifyBoardNotReady();
    return;
  }

  const createdId = await createSubBoard({
    name: draft.name,
    kind: draft.kind,
    parentBoardId: opts.boardBlockId,
  });
  if (createdId == null) return;

  const plan = planCollectIntoBoard(
    session.cards,
    session.edges,
    selected,
    createdId,
  );
  if (plan == null) {
    await abandonCreatedSubBoardIfEmpty(createdId);
    return;
  }

  const snapshot = {
    cards: session.cards.map((card) => ({ ...card })),
    edges: session.edges.map((edge) => ({ ...edge })),
    areas: opts.areas.map((area) => ({ ...area })),
  };

  // Write B first, then mutate A. Cards are pointers: a failed A-write
  // leaves a spare copy on B (nothing lost). The reverse would drop layout.
  try {
    await writeSessionSnapshot(
      createdId,
      plan.movedCards,
      plan.movedEdges,
      [],
      false,
    );
  } catch (err: unknown) {
    console.error("[whiteboard] failed to write collected sub-board", err);
    const dropped = await abandonCreatedSubBoardIfEmpty(createdId);
    orca.notify(
      "error",
      dropped
        ? t("Failed to create whiteboard")
        : t(
            "This board was not changed, but the new whiteboard already exists and has a copy of the cards.",
          ),
    );
    return;
  }
  const saved = await runAsHistoryStep(opts.boardBlockId, snapshot, () =>
    commitBoardOn(session, plan.leftoverCards, plan.leftoverEdges),
  );
  if (!saved) {
    discardLastRecord(opts.boardBlockId);
    orca.notify(
      "warn",
      t(
        "This board was not changed, but the new whiteboard already exists and has a copy of the cards.",
      ),
    );
    return;
  }

  opts.selectCards([createdId]);
  orca.notify(
    "success",
    t('Collected into "${name}". Undo will not remove the new whiteboard.', {
      name: draft.name,
    }),
  );
}
