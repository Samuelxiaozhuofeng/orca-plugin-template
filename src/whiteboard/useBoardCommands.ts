import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  cardPatchesChange,
  edgesMatchIgnoringLinked,
  historyDepth,
  holdHistory,
  planSnapshotWrite,
  recordBefore,
  discardLastRecord,
  restoreFailedRedo,
  restoreFailedUndo,
  shouldTellBlankCardUndo,
  takeRedo,
  takeUndo,
  type BoardSnapshot,
} from "./boardHistory";
import { type WhiteboardArea } from "./areas";
import { type WhiteboardCard } from "./cards";
import {
  placeJournalCards,
  viewportOrigin,
  type CanvasOrigin,
} from "./data";
import {
  abandonCreatedSubBoardIfEmpty,
  takeCreatedSubBoard,
} from "./collectIntoBoardApply";
import {
  coupleForRedo,
  coupleForUndo,
  noteIndependentMutation,
  restorePairedBoard,
} from "./crossBoardHistory";
import { writeEdgesAfterLinkSync } from "./edgeLinkSync";
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
    noteIndependentMutation(blockId);
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
      const prev = edgesRef.current;
      const changed = !edgesMatchIgnoringLinked(prev, next);
      if (changed) record();
      const ok = await writeEdgesAfterLinkSync(
        prev,
        next,
        (edges) => commitEdges(edges, cardIds),
        true, // user-edited lines: rehanging an endpoint must move the ref
      );
      if (!ok && changed && blockId != null) discardLastRecord(blockId);
      return ok;
    },
    [blockId, commitEdges, record],
  );

  const onRemoveCards = useCallback(
    async (ids: DbId[]): Promise<boolean> => {
      if (ids.length === 0) return true;
      const drop = new Set(ids);
      const next = cards.filter((card) => !drop.has(card.blockId));
      const currentEdges = edgesRef.current;
      const leftover = currentEdges.filter(
        (edge) => !drop.has(edge.from) && !drop.has(edge.to),
      );
      record();
      const release = blockId != null ? holdHistory(blockId) : holdHistory();
      try {
        const saved = await writeEdgesAfterLinkSync(
          currentEdges,
          leftover,
          (synced) => commitBoard(next, synced),
          false, // card removal is not a rehang
        );
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
    [blockId, cards, commitBoard, record],
  );

  const applySnapshot = useCallback(
    async (next: BoardSnapshot, current: BoardSnapshot): Promise<boolean> => {
      const plan = planSnapshotWrite(next, current);
      if (plan.mode === "cards-and-areas") {
        const ok = await commitCardsAndAreas(plan.cards, plan.areas);
        if (!ok) return false;
      } else if (plan.mode === "board") {
        const ok = await writeEdgesAfterLinkSync(
          current.edges,
          plan.edges,
          (edges) => commitBoard(plan.cards, edges),
          false, // undo/redo must not treat collect/drop remaps as rehangs
        );
        if (!ok) return false;
      } else if (plan.mode === "areas") {
        const ok = await commitAreas(plan.areas);
        if (!ok) return false;
      }
      const removed = current.cards.filter(
        (card) =>
          !next.cards.some((item) => item.blockId === card.blockId),
      );
      let removedShell = false;
      for (const card of removed) {
        if (!takeCreatedSubBoard(card.blockId)) continue;
        if (await abandonCreatedSubBoardIfEmpty(card.blockId)) {
          removedShell = true;
        }
      }
      const undidBlank = removed.some((card) => {
        const hosted = orca.state.blocks[card.blockId];
        return hosted?.parent === blockId;
      });
      if (undidBlank && !removedShell && shouldTellBlankCardUndo()) {
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
    const undoneDepth = historyDepth(blockId);
    const prev = takeUndo(blockId, current);
    if (prev == null) return;
    const couple = coupleForUndo(blockId, undoneDepth);
    void applySnapshot(prev, current).then(async (ok: boolean) => {
      if (!ok) {
        restoreFailedUndo(blockId, prev);
        bumpHistory();
        return;
      }
      if (couple != null) await restorePairedBoard(couple, blockId, "undo");
      bumpHistory();
    });
  }, [applySnapshot, blockId, bumpHistory, snapshotNow]);

  const onRedo = useCallback(() => {
    if (blockId == null) return;
    const current = snapshotNow();
    const next = takeRedo(blockId, current);
    if (next == null) return;
    const redoneDepth = historyDepth(blockId);
    const couple = coupleForRedo(blockId, redoneDepth);
    void applySnapshot(next, current).then(async (ok: boolean) => {
      if (!ok) {
        restoreFailedRedo(blockId, next);
        bumpHistory();
        return;
      }
      if (couple != null) await restorePairedBoard(couple, blockId, "redo");
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
          result.placed === 0
            ? t("No journals in this date range")
            : t(
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
        orca.notify("error", t("Failed to load journals"));
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
