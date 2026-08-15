import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { emitBoardCardsChanged } from "./boardEvents";
import {
  assertBoardWritable,
  notifyBoardUnreadable,
  retryLastBoardWrite,
  writeProperties,
} from "./boardWrite";
import {
  CARDS_PROP,
  PROP_TYPE_TEXT,
  cardsEqual,
  preparedCards,
  tryReadCards,
  writeCards,
  type WhiteboardCard,
} from "./cards";
import {
  EDGES_PROP,
  edgesEqual,
  preparedEdges,
  tryReadEdges,
  writeEdges,
  type WhiteboardEdge,
} from "./edges";

export type CardBoxPatch = Partial<
  Pick<WhiteboardCard, "x" | "y" | "w" | "h" | "color">
>;

export type BoardSession = {
  id: DbId;
  refCount: number;
  listeners: Set<() => void>;
  protect: boolean;
  cards: WhiteboardCard[];
  cardBaseline: WhiteboardCard[];
  cardPending: WhiteboardCard[] | null;
  cardDirty: boolean;
  cardAwaitingEcho: boolean;
  cardTimer: number;
  cardInFlight: boolean;
  cardFlight: Promise<void>;
  edges: WhiteboardEdge[];
  edgeBaseline: WhiteboardEdge[];
  edgePending: WhiteboardEdge[] | null;
  edgeDirty: boolean;
  edgeAwaitingEcho: boolean;
  edgeInFlight: boolean;
  edgeFlight: Promise<void>;
};

const sessions = new Map<DbId, BoardSession>();

export function getBoardSession(id: DbId): BoardSession | undefined {
  return sessions.get(id);
}

export function emitBoardSession(session: BoardSession): void {
  for (const listener of session.listeners) listener();
}

export function notifyWriteError(
  kind: "cards" | "edges",
  error: unknown,
): void {
  console.error(`[whiteboard] failed to save ${kind}`, error);
  orca.notify(
    "error",
    error instanceof Error
      ? error.message
      : kind === "cards"
        ? t("Failed to save card positions")
        : t("Failed to save connections"),
    {
      title: t("Retry"),
      action: () => {
        void retryLastBoardWrite().catch((retryError: unknown) => {
          notifyWriteError(kind, retryError);
        });
      },
    },
  );
}

export function refuseIfProtected(session: BoardSession): boolean {
  if (!session.protect) return false;
  notifyBoardUnreadable(session.id);
  return true;
}

function createSession(
  id: DbId,
  cards: WhiteboardCard[],
  edges: WhiteboardEdge[],
  protect: boolean,
): BoardSession {
  return {
    id,
    refCount: 0,
    listeners: new Set(),
    protect,
    cards,
    cardBaseline: cards,
    cardPending: null,
    cardDirty: false,
    cardAwaitingEcho: false,
    cardTimer: 0,
    cardInFlight: false,
    cardFlight: Promise.resolve(),
    edges,
    edgeBaseline: edges,
    edgePending: null,
    edgeDirty: false,
    edgeAwaitingEcho: false,
    edgeInFlight: false,
    edgeFlight: Promise.resolve(),
  };
}

/** Create the shared session if needed, without changing the panel refcount. */
export function ensureBoardSession(
  id: DbId,
  cards: WhiteboardCard[],
  edges: WhiteboardEdge[],
  protect: boolean,
): BoardSession {
  let session = sessions.get(id);
  if (session == null) {
    session = createSession(id, cards, edges, protect);
    sessions.set(id, session);
  }
  session.protect = protect;
  return session;
}

export function acquireBoardSession(
  id: DbId,
  cards: WhiteboardCard[],
  edges: WhiteboardEdge[],
  protect: boolean,
): BoardSession {
  const session = ensureBoardSession(id, cards, edges, protect);
  session.refCount += 1;
  return session;
}

export async function writeSessionSnapshot(
  id: DbId,
  cards: WhiteboardCard[],
  edges: WhiteboardEdge[],
): Promise<void> {
  await assertBoardWritable(id);
  const storedCards = preparedCards(cards);
  const storedEdges = preparedEdges(edges);
  const fresh = await writeProperties(id, [
    {
      name: CARDS_PROP,
      type: PROP_TYPE_TEXT,
      value: JSON.stringify(storedCards),
    },
    {
      name: EDGES_PROP,
      type: PROP_TYPE_TEXT,
      value: JSON.stringify(storedEdges),
    },
  ]);
  const block = fresh ?? orca.state.blocks[id];
  const cardsBack = tryReadCards(block);
  const edgesBack = tryReadEdges(block);
  if (!cardsBack.ok || !cardsEqual(cardsBack.value, storedCards)) {
    throw new Error(t("Whiteboard cards were not saved"));
  }
  if (!edgesBack.ok || !edgesEqual(edgesBack.value, storedEdges)) {
    throw new Error(t("Whiteboard connections were not saved"));
  }
  emitBoardCardsChanged(id);
}

export function releaseBoardSession(id: DbId): void {
  const session = sessions.get(id);
  if (session == null) return;
  session.refCount -= 1;
  if (session.refCount > 0) return;
  if (session.cardTimer !== 0) {
    window.clearTimeout(session.cardTimer);
    session.cardTimer = 0;
  }
  const leftoverCards = session.cardPending;
  const leftoverEdges = session.edgePending;
  sessions.delete(id);
  if (session.protect) return;
  if (leftoverCards == null && leftoverEdges == null) return;
  void session.cardFlight
    .then(() => session.edgeFlight)
    .then(async () => {
      if (leftoverCards != null && leftoverEdges != null) {
        await writeSessionSnapshot(id, leftoverCards, leftoverEdges);
        return;
      }
      if (leftoverCards != null) await writeCards(id, leftoverCards);
      if (leftoverEdges != null) await writeEdges(id, leftoverEdges);
    })
    .catch((error: unknown) => {
      notifyWriteError(leftoverCards != null ? "cards" : "edges", error);
    });
}

export function listBoardSessions(): BoardSession[] {
  return [...sessions.values()];
}
