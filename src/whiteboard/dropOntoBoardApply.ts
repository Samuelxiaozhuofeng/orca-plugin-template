import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import type { WhiteboardArea } from "./areas";
import { areasPropertyPresent, tryReadAreas } from "./areas";
import { discardLastRecord, runAsHistoryStep } from "./boardHistory";
import { boardCardName } from "./boardCardView";
import { commitBoardOn } from "./boardPersistCommit";
import { getOpenBoard } from "./boards";
import {
  getBoardSession,
  notifyBoardNotReady,
  refuseIfProtected,
  writeSessionSnapshot,
} from "./boardSession";
import {
  boardPropsReadable,
  loadBoardBlock,
  notifyBoardUnreadable,
} from "./boardWrite";
import type { WhiteboardCard } from "./cards";
import { tryReadCards } from "./cards";
import { planDropOntoBoard } from "./collectIntoBoard";
import { originBelowCards } from "./dropBlocks";
import { nextEdgeId, sanitizeEdges, tryReadEdges, type WhiteboardEdge } from "./edges";
import { GRID_ORIGIN } from "./layout";
import { isWhiteboardBlock } from "./pageBoardPlan";

const ALREADY_TOLD = "owb-drop-already-notified";

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

function alreadyTold(): Error {
  return new Error(ALREADY_TOLD);
}

function rekeyIncomingEdges(
  incoming: readonly WhiteboardEdge[],
  existing: readonly WhiteboardEdge[],
): WhiteboardEdge[] {
  const used = [...existing];
  return incoming.map((edge) => {
    if (!used.some((item) => item.id === edge.id)) {
      used.push(edge);
      return { ...edge };
    }
    const next = { ...edge, id: nextEdgeId(edge.from, edge.to, used) };
    used.push(next);
    return next;
  });
}

function mergeOntoTarget(
  existingCards: readonly WhiteboardCard[],
  existingEdges: readonly WhiteboardEdge[],
  incomingCards: readonly WhiteboardCard[],
  incomingEdges: readonly WhiteboardEdge[],
): { cards: WhiteboardCard[]; edges: WhiteboardEdge[] } {
  const occupied = new Set(existingCards.map((card) => card.blockId));
  const fresh = incomingCards.filter((card) => !occupied.has(card.blockId));
  return {
    cards: [...existingCards, ...fresh],
    edges: sanitizeEdges([
      ...existingEdges,
      ...rekeyIncomingEdges(incomingEdges, existingEdges),
    ]),
  };
}

type TargetWrite = {
  cards: WhiteboardCard[];
  edges: WhiteboardEdge[];
  commit: (cards: WhiteboardCard[], edges: WhiteboardEdge[]) => Promise<void>;
};

async function loadTargetWrite(targetId: DbId): Promise<TargetWrite> {
  const session = getBoardSession(targetId);
  if (session != null) {
    if (refuseIfProtected(session)) throw alreadyTold();
    if (!session.hydrated) {
      notifyBoardNotReady();
      throw alreadyTold();
    }
    return {
      cards: session.cards,
      edges: session.edges,
      async commit(cards, edges) {
        const ok = await commitBoardOn(session, cards, edges);
        if (!ok) throw alreadyTold();
      },
    };
  }
  if (getOpenBoard(targetId) != null) {
    notifyBoardNotReady();
    throw alreadyTold();
  }
  const block = await loadBoardBlock(targetId);
  if (!boardPropsReadable(block)) {
    notifyBoardUnreadable(targetId);
    throw alreadyTold();
  }
  const cardsRead = tryReadCards(block ?? undefined);
  const edgesRead = tryReadEdges(block ?? undefined);
  const areasRead = tryReadAreas(block ?? undefined);
  const existingCards = cardsRead.ok ? cardsRead.value : [];
  const existingEdges = edgesRead.ok ? edgesRead.value : [];
  const existingAreas = areasRead.ok ? areasRead.value : [];
  const areasPresent = areasPropertyPresent(block ?? undefined);
  return {
    cards: existingCards,
    edges: existingEdges,
    async commit(cards, edges) {
      await writeSessionSnapshot(
        targetId,
        cards,
        edges,
        existingAreas,
        areasPresent,
      );
    },
  };
}

/**
 * Write the payload onto B first, then mutate A. Returns false when the
 * caller should fall back to a regular move (nothing to drop).
 */
export async function dropCardsOntoBoard(opts: {
  boardBlockId: DbId;
  targetBoardId: DbId;
  movingIds: readonly DbId[];
  cards: readonly WhiteboardCard[];
  edges: readonly WhiteboardEdge[];
  areas: readonly WhiteboardArea[];
  selectCards: (ids: DbId[]) => void;
}): Promise<boolean> {
  if (refuseBoardA(opts.boardBlockId)) return true;

  const sessionA = getBoardSession(opts.boardBlockId);
  if (sessionA == null) {
    notifyBoardNotReady();
    return true;
  }

  let targetBlock = orca.state.blocks[opts.targetBoardId];
  if (!isWhiteboardBlock(targetBlock)) {
    targetBlock = (await loadBoardBlock(opts.targetBoardId)) ?? undefined;
  }
  if (!isWhiteboardBlock(targetBlock)) return false;

  let target: TargetWrite;
  try {
    target = await loadTargetWrite(opts.targetBoardId);
  } catch (err: unknown) {
    console.error("[whiteboard] failed to open drop target", err);
    if (!(err instanceof Error && err.message === ALREADY_TOLD)) {
      orca.notify(
        "error",
        err instanceof Error
          ? err.message
          : t("Could not add the cards to that whiteboard."),
      );
    }
    return true;
  }

  const origin =
    target.cards.length === 0
      ? { x: GRID_ORIGIN, y: GRID_ORIGIN }
      : originBelowCards(target.cards);
  const plan = planDropOntoBoard({
    cards: sessionA.cards,
    edges: sessionA.edges,
    movingIds: new Set(opts.movingIds),
    targetBoardId: opts.targetBoardId,
    currentBoardId: opts.boardBlockId,
    origin,
  });
  if (plan == null) return false;

  const snapshot = {
    cards: sessionA.cards.map((card) => ({ ...card })),
    edges: sessionA.edges.map((edge) => ({ ...edge })),
    areas: opts.areas.map((area) => ({ ...area })),
  };

  const merged = mergeOntoTarget(
    target.cards,
    target.edges,
    plan.movedCards,
    plan.movedEdges,
  );
  try {
    await target.commit(merged.cards, merged.edges);
  } catch (err: unknown) {
    console.error("[whiteboard] failed to write drop target", err);
    if (!(err instanceof Error && err.message === ALREADY_TOLD)) {
      orca.notify(
        "error",
        err instanceof Error
          ? err.message
          : t("Could not add the cards to that whiteboard."),
      );
    }
    return true;
  }
  const saved = await runAsHistoryStep(opts.boardBlockId, snapshot, () =>
    commitBoardOn(sessionA, plan.leftoverCards, plan.leftoverEdges),
  );
  if (!saved) {
    discardLastRecord(opts.boardBlockId);
    orca.notify(
      "warn",
      t(
        "This board was not changed, but the cards are already on the other whiteboard.",
      ),
    );
    return true;
  }

  opts.selectCards([opts.targetBoardId]);
  orca.notify(
    "success",
    t('Moved ${count} cards into "${name}".', {
      count: String(plan.movedCards.length),
      name: boardCardName(orca.state.blocks[opts.targetBoardId]),
    }),
  );
  return true;
}
