import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  cardPatchesChange,
  edgesMatchIgnoringLinked,
  holdHistory,
  preserveLinked,
  recordBefore,
  discardLastRecord,
  restoreFailedRedo,
  restoreFailedUndo,
  shouldTellBlankCardUndo,
  takeRedo,
  takeUndo,
  type BoardSnapshot,
} from "./boardHistory";
import { areasEqual, type WhiteboardArea } from "./areas";
import { type WhiteboardCard } from "./cards";
import {
  cardsEqual,
  edgesEqual,
  placeJournalCards,
  viewportOrigin,
  type CanvasOrigin,
} from "./data";
import { type WhiteboardEdge } from "./edges";
import { type PlaceDialogValue } from "./PlaceDialog";
import { type CanvasView } from "./viewTransform";

const { useCallback, useState } = window.React;

type Persist = {
  patchCards: (
    entries: ReadonlyArray<{
      blockId: DbId;
      patch: {
        x?: number;
        y?: number;
        w?: number;
        h?: number;
        color?: string;
      };
    }>,
  ) => void;
  appendCards: (incoming: WhiteboardCard[]) => Promise<boolean>;
  commitCards: (next: WhiteboardCard[]) => Promise<boolean>;
  commitEdges: (
    next: WhiteboardEdge[],
    cardIds?: ReadonlySet<DbId>,
  ) => Promise<boolean>;
  commitBoard: (
    cards: WhiteboardCard[],
    edges: WhiteboardEdge[],
  ) => Promise<boolean>;
  commitAreas: (next: WhiteboardArea[]) => Promise<boolean>;
  commitCardsAndAreas: (
    cards: WhiteboardCard[],
    areas: WhiteboardArea[],
  ) => Promise<boolean>;
};

export function useBoardCommands(opts: {
  blockId: DbId | undefined;
  cards: WhiteboardCard[];
  edges: WhiteboardEdge[];
  cardsRef: { current: WhiteboardCard[] };
  edgesRef: { current: WhiteboardEdge[] };
  areasRef: { current: WhiteboardArea[] };
  view: CanvasView;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  setPlaceOpen: (open: boolean) => void;
  persist: Persist;
}) {
  const {
    blockId,
    cards,
    edges,
    cardsRef,
    edgesRef,
    areasRef,
    view,
    busy,
    setBusy,
    setPlaceOpen,
    persist,
  } = opts;
  const {
    patchCards,
    appendCards,
    commitCards,
    commitEdges,
    commitBoard,
    commitAreas,
    commitCardsAndAreas,
  } = persist;
  const [historyTick, setHistoryTick] = useState(0);

  const bumpHistory = useCallback(() => {
    setHistoryTick((n: number) => n + 1);
  }, []);

  const snapshotNow = useCallback((): BoardSnapshot => {
    return {
      cards: cardsRef.current.map((card: WhiteboardCard) => ({ ...card })),
      edges: edgesRef.current.map((edge: WhiteboardEdge) => ({ ...edge })),
      areas: areasRef.current.map((area: WhiteboardArea) => ({ ...area })),
    };
  }, []);

  const record = useCallback(() => {
    if (blockId == null) return;
    recordBefore(blockId, snapshotNow());
    bumpHistory();
  }, [blockId, bumpHistory, snapshotNow]);

  const onPatchCards = useCallback(
    (
      entries: ReadonlyArray<{
        blockId: DbId;
        patch: {
          x?: number;
          y?: number;
          w?: number;
          h?: number;
          color?: string;
        };
      }>,
      opts?: { record?: boolean },
    ) => {
      if (opts?.record !== false && cardPatchesChange(cardsRef.current, entries)) {
        record();
      }
      patchCards(entries);
    },
    [patchCards, record],
  );

  const onAddCards = useCallback(
    async (incoming: WhiteboardCard[]): Promise<boolean> => {
      if (incoming.length === 0) return true;
      const occupied = new Set(
        cardsRef.current.map((card: WhiteboardCard) => card.blockId),
      );
      if (!incoming.some((card) => !occupied.has(card.blockId))) return true;
      record();
      return appendCards(incoming);
    },
    [appendCards, record],
  );

  const onCommitEdges = useCallback(
    async (
      next: WhiteboardEdge[],
      cardIds?: ReadonlySet<DbId>,
    ): Promise<boolean> => {
      if (!edgesMatchIgnoringLinked(edgesRef.current, next)) record();
      return commitEdges(next, cardIds);
    },
    [commitEdges, record],
  );

  const onRemoveCards = useCallback(
    async (ids: DbId[]): Promise<boolean> => {
      if (ids.length === 0) return true;
      const drop = new Set(ids);
      const next = cards.filter((card) => !drop.has(card.blockId));
      const leftover = edges.filter(
        (edge) => !drop.has(edge.from) && !drop.has(edge.to),
      );
      record();
      const release = blockId != null ? holdHistory(blockId) : holdHistory();
      try {
        const saved = await commitBoard(next, leftover);
        if (!saved) {
          if (blockId != null) discardLastRecord(blockId);
          return false;
        }
      } finally {
        release();
      }
      orca.notify(
        "info",
        t(
          "Removed ${count} cards from the board. Journals themselves were not deleted.",
          { count: String(ids.length) },
        ),
      );
      return true;
    },
    [blockId, cards, commitBoard, edges, record],
  );

  const applySnapshot = useCallback(
    async (next: BoardSnapshot, current: BoardSnapshot): Promise<boolean> => {
      const nextEdges = preserveLinked(next.edges, current.edges);
      const nextAreas = next.areas ?? current.areas ?? [];
      const currentAreas = current.areas ?? [];
      const cardsChanged = !cardsEqual(next.cards, current.cards);
      const edgesChanged = !edgesEqual(nextEdges, current.edges);
      const areaChanged = !areasEqual(nextAreas, currentAreas);
      if (cardsChanged && areaChanged && !edgesChanged) {
        const ok = await commitCardsAndAreas(next.cards, nextAreas);
        if (!ok) return false;
      } else if (cardsChanged || edgesChanged) {
        const ok = await commitBoard(next.cards, nextEdges);
        if (!ok) return false;
      } else if (areaChanged) {
        const ok = await commitAreas(nextAreas);
        if (!ok) return false;
      }
      const removed = current.cards.filter(
        (card) =>
          !next.cards.some((item) => item.blockId === card.blockId),
      );
      const undidBlank = removed.some((card) => {
        const hosted = orca.state.blocks[card.blockId];
        return hosted?.parent === blockId;
      });
      if (undidBlank && shouldTellBlankCardUndo()) {
        orca.notify(
          "info",
          t(
            "Undo removed the card from the board. The note is still under this whiteboard in the outline.",
          ),
        );
      }
      return true;
    },
    [blockId, commitAreas, commitBoard, commitCardsAndAreas],
  );

  const onUndo = useCallback(() => {
    if (blockId == null) return;
    const current = snapshotNow();
    const prev = takeUndo(blockId, current);
    if (prev == null) return;
    void applySnapshot(prev, current).then((ok: boolean) => {
      if (!ok) restoreFailedUndo(blockId, prev);
      bumpHistory();
    });
  }, [applySnapshot, blockId, bumpHistory, snapshotNow]);

  const onRedo = useCallback(() => {
    if (blockId == null) return;
    const current = snapshotNow();
    const next = takeRedo(blockId, current);
    if (next == null) return;
    void applySnapshot(next, current).then((ok: boolean) => {
      if (!ok) restoreFailedRedo(blockId, next);
      bumpHistory();
    });
  }, [applySnapshot, blockId, bumpHistory, snapshotNow]);

  const confirmPlace = useCallback(
    async (value: PlaceDialogValue, origin?: CanvasOrigin | null) => {
      if (busy || blockId == null) return;
      setBusy(true);
      try {
        const result = await placeJournalCards({
          ...value,
          origin: origin ?? viewportOrigin(view),
          existing: cards,
        });
        if (result.placed > 0) {
          // commitCards keeps the optimistic update, rolls back and notifies
          // on failure, and runs the read-back verify inside writeCards.
          record();
          const saved = await commitCards(result.cards);
          if (!saved) {
            discardLastRecord(blockId);
            return;
          }
        }
        setPlaceOpen(false);
        orca.notify(
          result.placed > 0 ? "success" : "info",
          t(
            "Added ${placed}, skipped ${existing} already on the board, filtered ${empty} empty journals",
            {
              placed: String(result.placed),
              existing: String(result.skippedExisting),
              empty: String(result.skippedEmpty),
            },
          ),
        );
      } catch (error) {
        console.error("[whiteboard] failed to load journals", error);
        orca.notify(
          "error",
          error instanceof Error ? error.message : t("Failed to load journals"),
        );
      } finally {
        setBusy(false);
      }
    },
    [blockId, busy, cards, commitCards, record, view],
  );

  return {
    historyTick,
    onPatchCards,
    onAddCards,
    onCommitEdges,
    onRemoveCards,
    onUndo,
    onRedo,
    confirmPlace,
  };
}
