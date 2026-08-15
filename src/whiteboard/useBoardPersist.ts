import type { DbId } from "../orca.d.ts";
import { type WhiteboardArea } from "./areas";
import { bindHistoryAreas } from "./boardHistory";
import {
  acquireBoardSession,
  ensureBoardSession,
  getBoardSession,
  listBoardSessions,
  type CardBoxPatch,
} from "./boardSession";
import {
  applyAreaEcho,
  applyCardEcho,
  applyEdgeEcho,
} from "./boardPersistEcho";
import {
  commitAreasOn,
  commitBoardOn,
  commitCardsOn,
  commitEdgesOn,
  flushAreas,
  flushCards,
  flushEdges,
  patchCardsOn,
  releaseBoardSessionAndFlush,
} from "./boardPersistQueue";
import { clearBoardProtectTold, notifyBoardUnreadable } from "./boardWrite";
import { type WhiteboardCard } from "./cards";
import { type WhiteboardEdge } from "./edges";

const { useCallback, useEffect, useRef, useState } = window.React;

bindHistoryAreas({
  read: (boardId) => getBoardSession(boardId)?.areas ?? [],
  apply: (boardId, areas) => {
    const session = getBoardSession(boardId);
    if (session == null) return;
    void commitAreasOn(session, areas);
  },
});

export async function flushAllSessionWrites(): Promise<void> {
  await Promise.all(
    listBoardSessions().map(async (session) => {
      await flushCards(session);
      await flushEdges(session);
      await flushAreas(session);
    }),
  );
}

export type BoardPersistApi = {
  cards: WhiteboardCard[];
  edges: WhiteboardEdge[];
  areas: WhiteboardArea[];
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
  commitAreas: (next: WhiteboardArea[]) => Promise<boolean>;
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
  serverAreas: WhiteboardArea[],
  protect: boolean,
  areasPresent: boolean,
): BoardPersistApi {
  if (blockId != null) {
    ensureBoardSession(
      blockId,
      serverCards,
      serverEdges,
      serverAreas,
      protect,
      areasPresent,
    );
  }
  const joined = blockId == null ? undefined : getBoardSession(blockId);
  const [cards, setCards] = useState(joined?.cards ?? serverCards);
  const [edges, setEdges] = useState(joined?.edges ?? serverEdges);
  const [areas, setAreas] = useState(joined?.areas ?? serverAreas);
  const serverCardsRef = useRef(serverCards);
  const serverEdgesRef = useRef(serverEdges);
  const serverAreasRef = useRef(serverAreas);
  serverCardsRef.current = serverCards;
  serverEdgesRef.current = serverEdges;
  serverAreasRef.current = serverAreas;

  useEffect(() => {
    if (blockId == null) {
      setCards(serverCardsRef.current);
      setEdges(serverEdgesRef.current);
      setAreas(serverAreasRef.current);
      return;
    }
    const session = acquireBoardSession(
      blockId,
      serverCardsRef.current,
      serverEdgesRef.current,
      serverAreasRef.current,
      protect,
      areasPresent,
    );
    const sync = () => {
      setCards(session.cards);
      setEdges(session.edges);
      setAreas(session.areas);
    };
    sync();
    session.listeners.add(sync);
    return () => {
      session.listeners.delete(sync);
      releaseBoardSessionAndFlush(blockId);
    };
  }, [blockId]);

  useEffect(() => {
    if (blockId == null) return;
    const session = getBoardSession(blockId);
    if (session == null) return;
    session.protect = protect;
    if (protect) notifyBoardUnreadable(blockId);
    else clearBoardProtectTold(blockId);
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

  useEffect(() => {
    if (blockId == null) return;
    const session = getBoardSession(blockId);
    if (session == null) return;
    applyAreaEcho(session, serverAreas, areasPresent);
  }, [blockId, serverAreas, areasPresent]);

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

  const commitAreas = useCallback(
    async (next: WhiteboardArea[]): Promise<boolean> => {
      if (blockId == null) return false;
      const session = getBoardSession(blockId);
      if (session == null) return false;
      return commitAreasOn(session, next);
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
    await flushAreas(session);
  }, [blockId]);

  return {
    cards,
    edges,
    areas,
    patchCard,
    patchCards,
    commitCards,
    appendCards,
    commitEdges,
    commitAreas,
    commitBoard,
    flush,
  };
}
