import type { DbId } from "../orca.d.ts";
import {
  emitBoardSession,
  getBoardSession,
  notifyWriteError,
  refuseIfProtected,
  writeSessionSnapshot,
  type BoardSession,
  type CardBoxPatch,
} from "./boardSession";
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

export async function flushCards(session: BoardSession): Promise<boolean> {
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

export async function flushEdges(session: BoardSession): Promise<boolean> {
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

export function patchCardsOn(
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

export async function commitCardsOn(
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

export async function commitEdgesOn(
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

export async function commitBoardOn(
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

export function applyCardEcho(
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

export function applyEdgeEcho(
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
