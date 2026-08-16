import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n.ts";
import {
  AREAS_PROP,
  areasEqual,
  preparedAreas,
  shouldPersistAreas,
  tryReadAreas,
  type WhiteboardArea,
} from "./areas.ts";
import { emitBoardCardsChanged } from "./boardEvents.ts";
import {
  assertBoardWritable,
  notifyBoardUnreadable,
  peekLastBoardWrite,
  retryBoardWrite,
  writeProperties,
} from "./boardWrite.ts";
import {
  CARDS_PROP,
  PROP_TYPE_TEXT,
  cardsEqual,
  preparedCards,
  tryReadCards,
  type WhiteboardCard,
} from "./cards.ts";
import {
  EDGES_PROP,
  edgesEqual,
  preparedEdges,
  tryReadEdges,
  type WhiteboardEdge,
} from "./edges.ts";

export type CardBoxPatch = Partial<
  Pick<WhiteboardCard, "x" | "y" | "w" | "h" | "color" | "hLock">
>;

export type BoardSession = {
  id: DbId;
  refCount: number;
  /** Pinned by `ensure` while no panel has acquired, so a remount can reuse it. */
  viewPinned: boolean;
  listeners: Set<() => void>;
  protect: boolean;
  /**
   * False until this session has seen a real board block. Missing cache must
   * not look like an empty board — writes and empty echoes stay off.
   */
  hydrated: boolean;
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
  areas: WhiteboardArea[];
  areaBaseline: WhiteboardArea[];
  areaPending: WhiteboardArea[] | null;
  areaDirty: boolean;
  areaAwaitingEcho: boolean;
  areaInFlight: boolean;
  areaFlight: Promise<void>;
  /** True once the board block has (or has been written) an `areas` property. */
  areasPresent: boolean;
};

const sessions = new Map<DbId, BoardSession>();

export function getBoardSession(id: DbId): BoardSession | undefined {
  return sessions.get(id);
}

export function emitBoardSession(session: BoardSession): void {
  for (const listener of session.listeners) listener();
}

export function notifyWriteError(
  kind: "cards" | "edges" | "areas",
  error: unknown,
  blockId: DbId,
): void {
  const payload = peekLastBoardWrite(blockId);
  console.error(`[whiteboard] failed to save ${kind}`, error);
  orca.notify(
    "error",
    kind === "cards"
      ? t("Failed to save card positions")
      : kind === "edges"
        ? t("Failed to save connections")
        : t("Failed to save sections"),
    {
      title: t("Retry"),
      action: () => {
        void retryBoardWrite(payload).catch((retryError: unknown) => {
          notifyWriteError(kind, retryError, blockId);
        });
      },
    },
  );
}

export function notifyBoardNotReady(): void {
  const host = (globalThis as { orca?: { notify?: (kind: string, msg: string) => void } })
    .orca;
  host?.notify?.("warn", t("Whiteboard is still loading"));
}

export function refuseIfProtected(session: BoardSession): boolean {
  if (!session.protect) return false;
  notifyBoardUnreadable(session.id);
  return true;
}

export function refuseIfNotHydrated(session: BoardSession): boolean {
  if (session.hydrated) return false;
  notifyBoardNotReady();
  return true;
}

export function refuseIfNotWritable(session: BoardSession): boolean {
  return refuseIfProtected(session) || refuseIfNotHydrated(session);
}

/** Closed-panel writes may use a live session; never a stub or protect board. */
export function sessionCanAcceptCards(
  session: BoardSession | null | undefined,
): session is BoardSession {
  return session != null && session.hydrated && !session.protect;
}

function createSession(
  id: DbId,
  cards: WhiteboardCard[],
  edges: WhiteboardEdge[],
  areas: WhiteboardArea[],
  protect: boolean,
  areasPresent: boolean,
  hydrated: boolean,
): BoardSession {
  return {
    id,
    refCount: 0,
    viewPinned: false,
    listeners: new Set(),
    protect,
    hydrated,
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
    areas,
    areaBaseline: areas,
    areaPending: null,
    areaDirty: false,
    areaAwaitingEcho: false,
    areaInFlight: false,
    areaFlight: Promise.resolve(),
    areasPresent,
  };
}

/** First successful read of this board. No-op if already hydrated. */
export function hydrateBoardSession(
  session: BoardSession,
  cards: WhiteboardCard[],
  edges: WhiteboardEdge[],
  areas: WhiteboardArea[],
  areasPresent: boolean,
): void {
  if (session.hydrated) return;
  session.hydrated = true;
  if (sessionHasPersistWork(session)) return;
  session.cards = cards;
  session.cardBaseline = cards;
  session.edges = edges;
  session.edgeBaseline = edges;
  session.areas = areas;
  session.areaBaseline = areas;
  session.areasPresent = areasPresent;
}

/** Create the shared session if needed, without changing the panel refcount. */
export function ensureBoardSession(
  id: DbId,
  cards: WhiteboardCard[],
  edges: WhiteboardEdge[],
  areas: WhiteboardArea[],
  protect: boolean,
  areasPresent: boolean,
  hydrated = true,
): BoardSession {
  let session = sessions.get(id);
  if (session == null) {
    session = createSession(
      id,
      cards,
      edges,
      areas,
      protect,
      areasPresent,
      hydrated,
    );
    sessions.set(id, session);
  } else if (!session.hydrated && hydrated) {
    hydrateBoardSession(session, cards, edges, areas, areasPresent);
  }
  session.protect = protect;
  if (session.refCount === 0) session.viewPinned = true;
  return session;
}

export function acquireBoardSession(
  id: DbId,
  cards: WhiteboardCard[],
  edges: WhiteboardEdge[],
  areas: WhiteboardArea[],
  protect: boolean,
  areasPresent: boolean,
  hydrated = true,
): BoardSession {
  const session = ensureBoardSession(
    id,
    cards,
    edges,
    areas,
    protect,
    areasPresent,
    hydrated,
  );
  session.refCount += 1;
  session.viewPinned = false;
  return session;
}

export function sessionHasPersistWork(session: BoardSession): boolean {
  return (
    session.cardTimer !== 0 ||
    session.cardPending != null ||
    session.edgePending != null ||
    session.areaPending != null ||
    session.cardInFlight ||
    session.edgeInFlight ||
    session.areaInFlight ||
    session.cardDirty ||
    session.edgeDirty ||
    session.areaDirty
  );
}

export function maybeDisposeBoardSession(id: DbId): void {
  const session = sessions.get(id);
  if (session == null) return;
  if (session.refCount > 0 || session.viewPinned) return;
  if (session.protect || !sessionHasPersistWork(session)) {
    sessions.delete(id);
  }
}

export async function writeSessionSnapshot(
  id: DbId,
  cards: WhiteboardCard[],
  edges: WhiteboardEdge[],
  areas: WhiteboardArea[],
  areasPresent: boolean,
): Promise<void> {
  await assertBoardWritable(id);
  const storedCards = preparedCards(cards);
  const storedEdges = preparedEdges(edges);
  const storedAreas = preparedAreas(areas);
  const persistAreas = shouldPersistAreas(storedAreas, areasPresent);
  const props = [
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
  ];
  if (persistAreas) {
    props.push({
      name: AREAS_PROP,
      type: PROP_TYPE_TEXT,
      value: JSON.stringify(storedAreas),
    });
  }
  const fresh = await writeProperties(id, props);
  const block = fresh ?? orca.state.blocks[id];
  const cardsBack = tryReadCards(block);
  const edgesBack = tryReadEdges(block);
  if (!cardsBack.ok || !cardsEqual(cardsBack.value, storedCards)) {
    throw new Error(t("Whiteboard cards were not saved"));
  }
  if (!edgesBack.ok || !edgesEqual(edgesBack.value, storedEdges)) {
    throw new Error(t("Whiteboard connections were not saved"));
  }
  if (persistAreas) {
    const areasBack = tryReadAreas(block);
    if (!areasBack.ok || !areasEqual(areasBack.value, storedAreas)) {
      throw new Error(t("Whiteboard sections were not saved"));
    }
  }
  emitBoardCardsChanged(id);
}

/** One `set-properties` for cards + areas. Does not touch the edges property. */
export async function writeCardsAndAreas(
  id: DbId,
  cards: WhiteboardCard[],
  areas: WhiteboardArea[],
  areasPresent: boolean,
): Promise<void> {
  await assertBoardWritable(id);
  const storedCards = preparedCards(cards);
  const storedAreas = preparedAreas(areas);
  const persistAreas = shouldPersistAreas(storedAreas, areasPresent);
  const props = [
    {
      name: CARDS_PROP,
      type: PROP_TYPE_TEXT,
      value: JSON.stringify(storedCards),
    },
  ];
  if (persistAreas) {
    props.push({
      name: AREAS_PROP,
      type: PROP_TYPE_TEXT,
      value: JSON.stringify(storedAreas),
    });
  }
  const fresh = await writeProperties(id, props);
  const block = fresh ?? orca.state.blocks[id];
  const cardsBack = tryReadCards(block);
  if (!cardsBack.ok || !cardsEqual(cardsBack.value, storedCards)) {
    throw new Error(t("Whiteboard cards were not saved"));
  }
  if (persistAreas) {
    const areasBack = tryReadAreas(block);
    if (!areasBack.ok || !areasEqual(areasBack.value, storedAreas)) {
      throw new Error(t("Whiteboard sections were not saved"));
    }
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
  if (session.protect) {
    sessions.delete(id);
    return;
  }
  if (!sessionHasPersistWork(session) && !session.viewPinned) {
    sessions.delete(id);
  }
}

export function listBoardSessions(): BoardSession[] {
  return [...sessions.values()];
}

export function resetBoardSessions(): void {
  sessions.clear();
}
