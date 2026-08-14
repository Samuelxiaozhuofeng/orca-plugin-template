import type { DbId } from "../orca.d.ts";
import {
  acquireBoardSession,
  emitBoardSession,
  ensureBoardSession,
  getBoardSession,
  listBoardSessions,
  notifyWriteError,
  refuseIfProtected,
  releaseBoardSession,
  writeSessionSnapshot,
  type BoardSession,
  type CardBoxPatch,
} from "./boardSession";
import { notifyBoardUnreadable } from "./boardWrite";
import {
  cardsEqual,
  writeCards,
  type WhiteboardCard,
} from "./cards";
import {
  edgesEqual,
  sanitizeEdges,
  writeEdges,
  type WhiteboardEdge,
} from "./edges";

const { useCallback, useEffect, useRef, useState } = window.React;

const WRITE_DEBOUNCE_MS = 300;

function enqueue<T>(
  session: BoardSession,
  lane: "card" | "edge",
  run: () => Promise<T>,
): Promise<T> {
  const key = lane === "card" ? "cardFlight" : "edgeFlight";
  const queued = session[key].then(run, run);
  session[key] = queued.then(
    () => {},
    () => {},
  );
  return queued;
}

async function flushCards(session: BoardSession): Promise<boolean> {
  if (session.cardTimer !== 0) {
    window.clearTimeout(session.cardTimer);
    session.cardTimer = 0;
  }
  if (session.cardPending == null || refuseIfProtected(session)) return true;
  const id = session.id;
  const toWrite = session.cardPending;
  session.cardPending = null;
  session.cardInFlight = true;
  const ok = await enqueue(session, "card", async () => {
    try {
      await writeCards(id, toWrite);
      if (getBoardSession(id) == null) return true;
      session.cardBaseline = toWrite;
      session.cardDirty = session.cardPending != null;
      session.cardAwaitingEcho = !session.cardDirty;
      return true;
    } catch (error) {
      if (getBoardSession(id) === session) {
        if (session.cardPending == null) {
          session.cardDirty = false;
          session.cardAwaitingEcho = false;
          session.cards = session.cardBaseline;
          emitBoardSession(session);
        } else {
          session.cardDirty = true;
          session.cardAwaitingEcho = false;
        }
        notifyWriteError("cards", error);
      }
      return false;
    }
  });
  session.cardInFlight = false;
  if (session.cardPending != null) return flushCards(session);
  return ok;
}

async function flushEdges(session: BoardSession): Promise<boolean> {
  if (session.edgePending == null || refuseIfProtected(session)) return true;
  const id = session.id;
  const toWrite = session.edgePending;
  session.edgePending = null;
  session.edgeInFlight = true;
  const ok = await enqueue(session, "edge", async () => {
    try {
      await writeEdges(id, toWrite);
      if (getBoardSession(id) == null) return true;
      session.edgeBaseline = toWrite;
      session.edgeDirty = session.edgePending != null;
      session.edgeAwaitingEcho = !session.edgeDirty;
      if (!edgesEqual(session.edges, toWrite) && session.edgePending == null) {
        session.edges = toWrite;
        emitBoardSession(session);
      }
      return true;
    } catch (error) {
      if (getBoardSession(id) === session) {
        if (session.edgePending == null) {
          session.edgeDirty = false;
          session.edgeAwaitingEcho = false;
          session.edges = session.edgeBaseline;
          emitBoardSession(session);
        } else {
          session.edgeDirty = true;
          session.edgeAwaitingEcho = false;
        }
        notifyWriteError("edges", error);
      }
      return false;
    }
  });
  session.edgeInFlight = false;
  if (session.edgePending != null) return flushEdges(session);
  return ok;
}

function scheduleCardWrite(session: BoardSession): void {
  session.cardPending = session.cards;
  session.cardDirty = true;
  if (session.cardTimer !== 0) window.clearTimeout(session.cardTimer);
  if (session.protect || session.cardInFlight) return;
  session.cardTimer = window.setTimeout(() => {
    session.cardTimer = 0;
    void flushCards(session);
  }, WRITE_DEBOUNCE_MS);
}

function patchCardsOn(
  session: BoardSession,
  entries: ReadonlyArray<{ blockId: DbId; patch: CardBoxPatch }>,
): void {
  if (entries.length === 0 || refuseIfProtected(session)) return;
  const byId = new Map<DbId, CardBoxPatch>();
  for (const entry of entries) {
    const prev = byId.get(entry.blockId);
    byId.set(
      entry.blockId,
      prev == null ? entry.patch : { ...prev, ...entry.patch },
    );
  }
  session.cards = session.cards.map((card) => {
    const patch = byId.get(card.blockId);
    return patch == null ? card : { ...card, ...patch };
  });
  emitBoardSession(session);
  scheduleCardWrite(session);
}

async function commitCardsOn(
  session: BoardSession,
  next: WhiteboardCard[],
): Promise<boolean> {
  if (refuseIfProtected(session)) return false;
  session.cards = next;
  session.cardPending = next;
  session.cardDirty = true;
  emitBoardSession(session);
  return flushCards(session);
}

async function commitEdgesOn(
  session: BoardSession,
  next: WhiteboardEdge[],
): Promise<boolean> {
  if (refuseIfProtected(session)) return false;
  const cleaned = sanitizeEdges(next);
  session.edges = cleaned;
  session.edgePending = cleaned;
  session.edgeDirty = true;
  emitBoardSession(session);
  return flushEdges(session);
}

async function commitBoardOn(
  session: BoardSession,
  cards: WhiteboardCard[],
  edges: WhiteboardEdge[],
): Promise<boolean> {
  if (refuseIfProtected(session)) return false;
  if (session.cardTimer !== 0) {
    window.clearTimeout(session.cardTimer);
    session.cardTimer = 0;
  }
  session.cardPending = null;
  session.edgePending = null;
  session.cards = cards;
  session.edges = sanitizeEdges(edges);
  session.cardDirty = true;
  session.edgeDirty = true;
  emitBoardSession(session);
  await session.cardFlight;
  await session.edgeFlight;
  if (getBoardSession(session.id) !== session) return true;
  try {
    await writeSessionSnapshot(session.id, session.cards, session.edges);
    if (getBoardSession(session.id) !== session) return true;
    session.cardBaseline = session.cards;
    session.edgeBaseline = session.edges;
    session.cardDirty = false;
    session.edgeDirty = false;
    session.cardAwaitingEcho = true;
    session.edgeAwaitingEcho = true;
    return true;
  } catch (error) {
    if (getBoardSession(session.id) === session) {
      session.cards = session.cardBaseline;
      session.edges = session.edgeBaseline;
      session.cardDirty = false;
      session.edgeDirty = false;
      session.cardAwaitingEcho = false;
      session.edgeAwaitingEcho = false;
      emitBoardSession(session);
      notifyWriteError("cards", error);
    }
    return false;
  }
}

function applyCardEcho(
  session: BoardSession,
  serverCards: WhiteboardCard[],
): void {
  if (session.protect) return;
  if (session.cardAwaitingEcho) {
    if (cardsEqual(serverCards, session.cards)) {
      session.cardAwaitingEcho = false;
      session.cardBaseline = serverCards;
    }
    return;
  }
  if (session.cardPending != null || session.cardDirty || session.cardInFlight) {
    return;
  }
  if (!cardsEqual(serverCards, session.cards)) {
    session.cards = serverCards;
    session.cardBaseline = serverCards;
    emitBoardSession(session);
  }
}

function applyEdgeEcho(
  session: BoardSession,
  serverEdges: WhiteboardEdge[],
): void {
  if (session.protect) return;
  if (session.edgeAwaitingEcho) {
    if (edgesEqual(serverEdges, session.edges)) {
      session.edgeAwaitingEcho = false;
      session.edgeBaseline = serverEdges;
    }
    return;
  }
  if (session.edgePending != null || session.edgeDirty || session.edgeInFlight) {
    return;
  }
  if (!edgesEqual(serverEdges, session.edges)) {
    session.edges = serverEdges;
    session.edgeBaseline = serverEdges;
    emitBoardSession(session);
  }
}

export async function flushAllSessionWrites(): Promise<void> {
  await Promise.all(
    listBoardSessions().map(async (session) => {
      await flushCards(session);
      await flushEdges(session);
    }),
  );
}

export type BoardPersistApi = {
  cards: WhiteboardCard[];
  edges: WhiteboardEdge[];
  patchCard: (cardBlockId: DbId, patch: CardBoxPatch) => void;
  patchCards: (
    entries: ReadonlyArray<{ blockId: DbId; patch: CardBoxPatch }>,
  ) => void;
  commitCards: (next: WhiteboardCard[]) => Promise<boolean>;
  appendCards: (incoming: WhiteboardCard[]) => Promise<boolean>;
  commitEdges: (
    next: WhiteboardEdge[],
    cardIds?: ReadonlySet<DbId>,
  ) => Promise<boolean>;
  commitBoard: (
    cards: WhiteboardCard[],
    edges: WhiteboardEdge[],
  ) => Promise<boolean>;
  flush: () => Promise<void>;
};

export function useBoardPersist(
  blockId: DbId | null,
  serverCards: WhiteboardCard[],
  serverEdges: WhiteboardEdge[],
  protect: boolean,
): BoardPersistApi {
  if (blockId != null) {
    ensureBoardSession(blockId, serverCards, serverEdges, protect);
  }
  const joined = blockId == null ? undefined : getBoardSession(blockId);
  const [cards, setCards] = useState(joined?.cards ?? serverCards);
  const [edges, setEdges] = useState(joined?.edges ?? serverEdges);
  const serverCardsRef = useRef(serverCards);
  const serverEdgesRef = useRef(serverEdges);
  serverCardsRef.current = serverCards;
  serverEdgesRef.current = serverEdges;

  useEffect(() => {
    if (blockId == null) {
      setCards(serverCardsRef.current);
      setEdges(serverEdgesRef.current);
      return;
    }
    const session = acquireBoardSession(
      blockId,
      serverCardsRef.current,
      serverEdgesRef.current,
      protect,
    );
    const sync = () => {
      setCards(session.cards);
      setEdges(session.edges);
    };
    sync();
    session.listeners.add(sync);
    return () => {
      session.listeners.delete(sync);
      releaseBoardSession(blockId);
    };
  }, [blockId]);

  useEffect(() => {
    if (blockId == null) return;
    const session = getBoardSession(blockId);
    if (session == null) return;
    session.protect = protect;
    if (protect) notifyBoardUnreadable(blockId);
  }, [blockId, protect]);

  useEffect(() => {
    if (blockId == null) return;
    const session = getBoardSession(blockId);
    if (session == null) return;
    applyCardEcho(session, serverCards);
  }, [blockId, serverCards]);

  useEffect(() => {
    if (blockId == null) return;
    const session = getBoardSession(blockId);
    if (session == null) return;
    applyEdgeEcho(session, serverEdges);
  }, [blockId, serverEdges]);

  const patchCards = useCallback(
    (entries: ReadonlyArray<{ blockId: DbId; patch: CardBoxPatch }>) => {
      if (blockId == null) return;
      const session = getBoardSession(blockId);
      if (session == null) return;
      patchCardsOn(session, entries);
    },
    [blockId],
  );

  const patchCard = useCallback(
    (cardBlockId: DbId, patch: CardBoxPatch) => {
      patchCards([{ blockId: cardBlockId, patch }]);
    },
    [patchCards],
  );

  const commitCards = useCallback(
    async (next: WhiteboardCard[]): Promise<boolean> => {
      if (blockId == null) return false;
      const session = getBoardSession(blockId);
      if (session == null) return false;
      return commitCardsOn(session, next);
    },
    [blockId],
  );

  const appendCards = useCallback(
    async (incoming: WhiteboardCard[]): Promise<boolean> => {
      if (blockId == null || incoming.length === 0) return true;
      const session = getBoardSession(blockId);
      if (session == null) return false;
      const occupied = new Set(session.cards.map((card) => card.blockId));
      const fresh = incoming.filter((card) => !occupied.has(card.blockId));
      if (fresh.length === 0) return true;
      return commitCardsOn(session, [...session.cards, ...fresh]);
    },
    [blockId],
  );

  const commitEdges = useCallback(
    async (
      next: WhiteboardEdge[],
      _cardIds?: ReadonlySet<DbId>,
    ): Promise<boolean> => {
      if (blockId == null) return false;
      const session = getBoardSession(blockId);
      if (session == null) return false;
      return commitEdgesOn(session, next);
    },
    [blockId],
  );

  const commitBoard = useCallback(
    async (
      nextCards: WhiteboardCard[],
      nextEdges: WhiteboardEdge[],
    ): Promise<boolean> => {
      if (blockId == null) return false;
      const session = getBoardSession(blockId);
      if (session == null) return false;
      return commitBoardOn(session, nextCards, nextEdges);
    },
    [blockId],
  );

  const flush = useCallback(async () => {
    if (blockId == null) return;
    const session = getBoardSession(blockId);
    if (session == null) return;
    await flushCards(session);
    await flushEdges(session);
  }, [blockId]);

  return {
    cards,
    edges,
    patchCard,
    patchCards,
    commitCards,
    appendCards,
    commitEdges,
    commitBoard,
    flush,
  };
}
