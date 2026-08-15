import type { DbId } from "../orca.d.ts";
import {
  emitBoardSession,
  getBoardSession,
  maybeDisposeBoardSession,
  notifyWriteError,
  refuseIfProtected,
  releaseBoardSession,
  writeSessionSnapshot,
  type BoardSession,
  type CardBoxPatch,
} from "./boardSession.ts";
import {
  cardsEqual,
  writeCards,
  type WhiteboardCard,
} from "./cards.ts";
import {
  edgesEqual,
  sanitizeEdges,
  writeEdges,
  type WhiteboardEdge,
} from "./edges.ts";

const WRITE_DEBOUNCE_MS = 300;

type LaneGen = { issued: number; applied: number };

const writeGens = new Map<DbId, { card: LaneGen; edge: LaneGen }>();

function laneGen(id: DbId, lane: "card" | "edge"): LaneGen {
  let gen = writeGens.get(id);
  if (gen == null) {
    gen = {
      card: { issued: 0, applied: 0 },
      edge: { issued: 0, applied: 0 },
    };
    writeGens.set(id, gen);
  }
  return gen[lane];
}

function takeLaneSeq(id: DbId, lane: "card" | "edge"): number {
  const gen = laneGen(id, lane);
  gen.issued += 1;
  return gen.issued;
}

/** Apply a write result only when its seq is strictly newer than the last applied. */
export function shouldApplyPersistSeq(
  appliedSeq: number,
  incomingSeq: number,
): boolean {
  return incomingSeq > appliedSeq;
}

function shouldSendPersistSeq(issuedSeq: number, writeSeq: number): boolean {
  return writeSeq === issuedSeq;
}

export function releaseBoardSessionAndFlush(id: DbId): void {
  releaseBoardSession(id);
  const session = getBoardSession(id);
  if (session == null || session.refCount > 0) return;
  void flushCards(session);
  void flushEdges(session);
}

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

async function idleLane(
  session: BoardSession,
  lane: "card" | "edge",
): Promise<boolean> {
  await (lane === "card" ? session.cardFlight : session.edgeFlight);
  maybeDisposeBoardSession(session.id);
  return true;
}

export async function flushCards(session: BoardSession): Promise<boolean> {
  if (session.cardTimer !== 0) {
    window.clearTimeout(session.cardTimer);
    session.cardTimer = 0;
  }
  if (session.cardPending == null || refuseIfProtected(session)) {
    return idleLane(session, "card");
  }
  const id = session.id;
  const toWrite = session.cardPending;
  session.cardPending = null;
  session.cardInFlight = true;
  const seq = takeLaneSeq(id, "card");
  const ok = await enqueue(session, "card", async () => {
    const gen = laneGen(id, "card");
    if (
      session.cardPending != null ||
      !shouldSendPersistSeq(gen.issued, seq)
    ) {
      return true;
    }
    try {
      await writeCards(id, toWrite);
      if (getBoardSession(id) !== session) return true;
      if (!shouldApplyPersistSeq(gen.applied, seq)) return true;
      gen.applied = seq;
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
  maybeDisposeBoardSession(id);
  return ok;
}

export async function flushEdges(session: BoardSession): Promise<boolean> {
  if (session.edgePending == null || refuseIfProtected(session)) {
    return idleLane(session, "edge");
  }
  const id = session.id;
  const toWrite = session.edgePending;
  session.edgePending = null;
  session.edgeInFlight = true;
  const seq = takeLaneSeq(id, "edge");
  const ok = await enqueue(session, "edge", async () => {
    const gen = laneGen(id, "edge");
    if (
      session.edgePending != null ||
      !shouldSendPersistSeq(gen.issued, seq)
    ) {
      return true;
    }
    try {
      await writeEdges(id, toWrite);
      if (getBoardSession(id) !== session) return true;
      if (!shouldApplyPersistSeq(gen.applied, seq)) return true;
      gen.applied = seq;
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
  maybeDisposeBoardSession(id);
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
  const id = session.id;
  const toWriteCards = session.cards;
  const toWriteEdges = session.edges;
  const ok = await enqueue(session, "card", async () =>
    enqueue(session, "edge", async () => {
      if (getBoardSession(id) !== session) return true;
      if (session.cardPending != null || session.edgePending != null) {
        return true;
      }
      const cardSeq = takeLaneSeq(id, "card");
      const edgeSeq = takeLaneSeq(id, "edge");
      const cardsGen = laneGen(id, "card");
      const edgesGen = laneGen(id, "edge");
      try {
        await writeSessionSnapshot(id, toWriteCards, toWriteEdges);
        if (getBoardSession(id) !== session) return true;
        if (shouldApplyPersistSeq(cardsGen.applied, cardSeq)) {
          cardsGen.applied = cardSeq;
          session.cardBaseline = toWriteCards;
          session.cardDirty = session.cardPending != null;
          session.cardAwaitingEcho = !session.cardDirty;
        }
        if (shouldApplyPersistSeq(edgesGen.applied, edgeSeq)) {
          edgesGen.applied = edgeSeq;
          session.edgeBaseline = toWriteEdges;
          session.edgeDirty = session.edgePending != null;
          session.edgeAwaitingEcho = !session.edgeDirty;
        }
        return true;
      } catch (error) {
        if (getBoardSession(id) === session) {
          if (session.cardPending == null) {
            session.cards = session.cardBaseline;
            session.cardDirty = false;
            session.cardAwaitingEcho = false;
          } else {
            session.cardDirty = true;
            session.cardAwaitingEcho = false;
          }
          if (session.edgePending == null) {
            session.edges = session.edgeBaseline;
            session.edgeDirty = false;
            session.edgeAwaitingEcho = false;
          } else {
            session.edgeDirty = true;
            session.edgeAwaitingEcho = false;
          }
          emitBoardSession(session);
          notifyWriteError("cards", error);
        }
        return false;
      }
    }),
  );
  let result = ok;
  if (session.cardPending != null) {
    result = (await flushCards(session)) && result;
  }
  if (session.edgePending != null) {
    result = (await flushEdges(session)) && result;
  }
  maybeDisposeBoardSession(id);
  return result;
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
