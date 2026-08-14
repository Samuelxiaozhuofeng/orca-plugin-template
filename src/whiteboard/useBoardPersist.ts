import type { DbId } from "../orca.d.ts";
import {
  acquireBoardSession,
  ensureBoardSession,
  getBoardSession,
  listBoardSessions,
  releaseBoardSession,
  type CardBoxPatch,
} from "./boardSession";
import {
  applyCardEcho,
  applyEdgeEcho,
  commitBoardOn,
  commitCardsOn,
  commitEdgesOn,
  flushCards,
  flushEdges,
  patchCardsOn,
} from "./boardPersistQueue";
import { notifyBoardUnreadable } from "./boardWrite";
import { type WhiteboardCard } from "./cards";
import { type WhiteboardEdge } from "./edges";

const { useCallback, useEffect, useRef, useState } = window.React;

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
