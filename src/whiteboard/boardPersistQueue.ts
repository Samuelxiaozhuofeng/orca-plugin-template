import type { DbId } from "../orca.d.ts";
import {
  areasEqual,
  shouldPersistAreas,
  writeAreas,
  type WhiteboardArea,
} from "./areas.ts";
import {
  laneGen,
  shouldApplyPersistSeq,
  shouldSendPersistSeq,
  takeLaneSeq,
  type PersistLane,
} from "./boardPersistSeq.ts";
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
  writeCards,
  type WhiteboardCard,
} from "./cards.ts";
import {
  edgesEqual,
  sanitizeEdges,
  writeEdges,
  type WhiteboardEdge,
} from "./edges.ts";

export { shouldApplyPersistSeq } from "./boardPersistSeq.ts";

const WRITE_DEBOUNCE_MS = 300;

export function releaseBoardSessionAndFlush(id: DbId): void {
  releaseBoardSession(id);
  const session = getBoardSession(id);
  if (session == null || session.refCount > 0) return;
  void flushCards(session);
  void flushEdges(session);
  void flushAreas(session);
}

function flightKey(
  lane: PersistLane,
): "cardFlight" | "edgeFlight" | "areaFlight" {
  if (lane === "card") return "cardFlight";
  if (lane === "edge") return "edgeFlight";
  return "areaFlight";
}

function enqueue<T>(
  session: BoardSession,
  lane: PersistLane,
  run: () => Promise<T>,
): Promise<T> {
  const key = flightKey(lane);
  const queued = session[key].then(run, run);
  session[key] = queued.then(
    () => {},
    () => {},
  );
  return queued;
}

async function idleLane(
  session: BoardSession,
  lane: PersistLane,
): Promise<boolean> {
  await session[flightKey(lane)];
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

export async function flushAreas(session: BoardSession): Promise<boolean> {
  if (session.areaPending == null || refuseIfProtected(session)) {
    return idleLane(session, "area");
  }
  const id = session.id;
  const toWrite = session.areaPending;
  session.areaPending = null;
  session.areaInFlight = true;
  const seq = takeLaneSeq(id, "area");
  const ok = await enqueue(session, "area", async () => {
    const gen = laneGen(id, "area");
    if (
      session.areaPending != null ||
      !shouldSendPersistSeq(gen.issued, seq)
    ) {
      return true;
    }
    try {
      await writeAreas(id, toWrite, session.areasPresent);
      if (getBoardSession(id) !== session) return true;
      if (!shouldApplyPersistSeq(gen.applied, seq)) return true;
      gen.applied = seq;
      if (shouldPersistAreas(toWrite, session.areasPresent)) {
        session.areasPresent = true;
      }
      session.areaBaseline = toWrite;
      session.areaDirty = session.areaPending != null;
      session.areaAwaitingEcho = !session.areaDirty;
      if (!areasEqual(session.areas, toWrite) && session.areaPending == null) {
        session.areas = toWrite;
        emitBoardSession(session);
      }
      return true;
    } catch (error) {
      if (getBoardSession(id) === session) {
        if (session.areaPending == null) {
          session.areaDirty = false;
          session.areaAwaitingEcho = false;
          session.areas = session.areaBaseline;
          emitBoardSession(session);
        } else {
          session.areaDirty = true;
          session.areaAwaitingEcho = false;
        }
        notifyWriteError("areas", error);
      }
      return false;
    }
  });
  session.areaInFlight = false;
  if (session.areaPending != null) return flushAreas(session);
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

export async function commitAreasOn(
  session: BoardSession,
  next: WhiteboardArea[],
): Promise<boolean> {
  if (refuseIfProtected(session)) return false;
  session.areas = next;
  session.areaPending = next;
  session.areaDirty = true;
  emitBoardSession(session);
  return flushAreas(session);
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
  session.areaPending = null;
  session.cards = cards;
  session.edges = sanitizeEdges(edges);
  session.cardDirty = true;
  session.edgeDirty = true;
  session.areaDirty = true;
  emitBoardSession(session);
  const id = session.id;
  const toWriteCards = session.cards;
  const toWriteEdges = session.edges;
  const toWriteAreas = session.areas;
  const areasPresent = session.areasPresent;
  const ok = await enqueue(session, "card", async () =>
    enqueue(session, "edge", async () =>
      enqueue(session, "area", async () => {
        if (getBoardSession(id) !== session) return true;
        if (
          session.cardPending != null ||
          session.edgePending != null ||
          session.areaPending != null
        ) {
          return true;
        }
        const cardSeq = takeLaneSeq(id, "card");
        const edgeSeq = takeLaneSeq(id, "edge");
        const areaSeq = takeLaneSeq(id, "area");
        const cardsGen = laneGen(id, "card");
        const edgesGen = laneGen(id, "edge");
        const areasGen = laneGen(id, "area");
        try {
          await writeSessionSnapshot(
            id,
            toWriteCards,
            toWriteEdges,
            toWriteAreas,
            areasPresent,
          );
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
          if (shouldApplyPersistSeq(areasGen.applied, areaSeq)) {
            areasGen.applied = areaSeq;
            if (shouldPersistAreas(toWriteAreas, areasPresent)) {
              session.areasPresent = true;
            }
            session.areaBaseline = toWriteAreas;
            session.areaDirty = session.areaPending != null;
            session.areaAwaitingEcho = !session.areaDirty;
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
            if (session.areaPending == null) {
              session.areas = session.areaBaseline;
              session.areaDirty = false;
              session.areaAwaitingEcho = false;
            } else {
              session.areaDirty = true;
              session.areaAwaitingEcho = false;
            }
            emitBoardSession(session);
            notifyWriteError("cards", error);
          }
          return false;
        }
      }),
    ),
  );
  let result = ok;
  if (session.cardPending != null) {
    result = (await flushCards(session)) && result;
  }
  if (session.edgePending != null) {
    result = (await flushEdges(session)) && result;
  }
  if (session.areaPending != null) {
    result = (await flushAreas(session)) && result;
  }
  maybeDisposeBoardSession(id);
  return result;
}
