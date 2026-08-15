import { areasEqual, type WhiteboardArea } from "./areas.ts";
import { emitBoardSession, type BoardSession } from "./boardSession.ts";
import { cardsEqual, type WhiteboardCard } from "./cards.ts";
import { edgesEqual, type WhiteboardEdge } from "./edges.ts";

export function applyCardEcho(
  session: BoardSession,
  serverCards: WhiteboardCard[],
): void {
  if (session.protect || !session.hydrated) return;
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
  if (session.protect || !session.hydrated) return;
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

export function applyAreaEcho(
  session: BoardSession,
  serverAreas: WhiteboardArea[],
  areasPresent: boolean,
): void {
  if (session.protect || !session.hydrated) return;
  if (areasPresent) session.areasPresent = true;
  if (session.areaAwaitingEcho) {
    if (areasEqual(serverAreas, session.areas)) {
      session.areaAwaitingEcho = false;
      session.areaBaseline = serverAreas;
    }
    return;
  }
  if (session.areaPending != null || session.areaDirty || session.areaInFlight) {
    return;
  }
  if (!areasEqual(serverAreas, session.areas)) {
    session.areas = serverAreas;
    session.areaBaseline = serverAreas;
    emitBoardSession(session);
  }
}
