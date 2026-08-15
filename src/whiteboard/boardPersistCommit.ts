import { shouldPersistAreas, type WhiteboardArea } from "./areas.ts";
import { enqueue, flushAreas, flushCards, flushEdges } from "./boardPersistQueue.ts";
import {
  laneGen,
  shouldApplyPersistSeq,
  shouldSendPersistSeq,
  takeLaneSeq,
} from "./boardPersistSeq.ts";
import {
  emitBoardSession,
  getBoardSession,
  maybeDisposeBoardSession,
  notifyWriteError,
  refuseIfNotWritable,
  writeCardsAndAreas,
  writeSessionSnapshot,
  type BoardSession,
} from "./boardSession.ts";
import { type WhiteboardCard } from "./cards.ts";
import { sanitizeEdges, type WhiteboardEdge } from "./edges.ts";

export async function commitBoardOn(
  session: BoardSession,
  cards: WhiteboardCard[],
  edges: WhiteboardEdge[],
): Promise<boolean> {
  if (refuseIfNotWritable(session)) return false;
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
        if (
          !shouldSendPersistSeq(cardsGen.issued, cardSeq) ||
          !shouldSendPersistSeq(edgesGen.issued, edgeSeq) ||
          !shouldSendPersistSeq(areasGen.issued, areaSeq)
        ) {
          return true;
        }
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
            notifyWriteError("cards", error, id);
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

/** One write for cards + areas. Leaves the edge lane alone. */
export async function commitCardsAndAreasOn(
  session: BoardSession,
  cards: WhiteboardCard[],
  areas: WhiteboardArea[],
): Promise<boolean> {
  if (refuseIfNotWritable(session)) return false;
  if (session.cardTimer !== 0) {
    window.clearTimeout(session.cardTimer);
    session.cardTimer = 0;
  }
  session.cardPending = null;
  session.areaPending = null;
  session.cards = cards;
  session.areas = areas;
  session.cardDirty = true;
  session.areaDirty = true;
  emitBoardSession(session);
  const id = session.id;
  const toWriteCards = session.cards;
  const toWriteAreas = session.areas;
  const areasPresent = session.areasPresent;
  const ok = await enqueue(session, "card", async () =>
    enqueue(session, "area", async () => {
      if (getBoardSession(id) !== session) return true;
      if (session.cardPending != null || session.areaPending != null) {
        return true;
      }
      const cardSeq = takeLaneSeq(id, "card");
      const areaSeq = takeLaneSeq(id, "area");
      const cardsGen = laneGen(id, "card");
      const areasGen = laneGen(id, "area");
      if (
        !shouldSendPersistSeq(cardsGen.issued, cardSeq) ||
        !shouldSendPersistSeq(areasGen.issued, areaSeq)
      ) {
        return true;
      }
      try {
        await writeCardsAndAreas(id, toWriteCards, toWriteAreas, areasPresent);
        if (getBoardSession(id) !== session) return true;
        if (shouldApplyPersistSeq(cardsGen.applied, cardSeq)) {
          cardsGen.applied = cardSeq;
          session.cardBaseline = toWriteCards;
          session.cardDirty = session.cardPending != null;
          session.cardAwaitingEcho = !session.cardDirty;
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
          if (session.areaPending == null) {
            session.areas = session.areaBaseline;
            session.areaDirty = false;
            session.areaAwaitingEcho = false;
          } else {
            session.areaDirty = true;
            session.areaAwaitingEcho = false;
          }
          emitBoardSession(session);
          notifyWriteError("cards", error, id);
        }
        return false;
      }
    }),
  );
  let result = ok;
  if (session.cardPending != null) {
    result = (await flushCards(session)) && result;
  }
  if (session.areaPending != null) {
    result = (await flushAreas(session)) && result;
  }
  maybeDisposeBoardSession(id);
  return result;
}
