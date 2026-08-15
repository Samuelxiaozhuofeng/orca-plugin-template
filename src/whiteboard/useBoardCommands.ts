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
import { planBoardAfterRestore, readExtractRestore } from "./cardExtractModel";
import {
  invertNoteAction,
  makeExtractNoteAction,
} from "./cardExtractRestore";
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
};

export function useBoardCommands(opts: {
  blockId: DbId | undefined;
  cards: WhiteboardCard[];
  edges: WhiteboardEdge[];
  cardsRef: { current: WhiteboardCard[] };
  edgesRef: { current: WhiteboardEdge[] };
  view: CanvasView;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  setPlaceOpen: (open: boolean) => void;
  setWeekdayGuide: (guide: CanvasOrigin | null) => void;
  persist: Persist;
}) {
  const {
    blockId,
    cards,
    edges,
    cardsRef,
    edgesRef,
    view,
    busy,
    setBusy,
    setPlaceOpen,
    setWeekdayGuide,
    persist,
  } = opts;
  const { patchCards, appendCards, commitCards, commitEdges, commitBoard } =
    persist;
  const [historyTick, setHistoryTick] = useState(0);

  const bumpHistory = useCallback(() => {
    setHistoryTick((n: number) => n + 1);
  }, []);

  const snapshotNow = useCallback((): BoardSnapshot => {
    return {
      cards: cardsRef.current.map((card: WhiteboardCard) => ({ ...card })),
      edges: edgesRef.current.map((edge: WhiteboardEdge) => ({ ...edge })),
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
      const release = holdHistory();
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
      const cardsChanged = !cardsEqual(next.cards, current.cards);
      const edgesChanged = !edgesEqual(nextEdges, current.edges);
      if (cardsChanged || edgesChanged) {
        const ok = await commitBoard(next.cards, nextEdges);
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
    [blockId, commitBoard],
  );

  const applyHistoryTarget = useCallback(
    async (
      target: BoardSnapshot,
      current: BoardSnapshot,
      direction: "undo" | "redo",
    ): Promise<boolean> => {
      const note = target.note;
      if (note != null) {
        try {
          if (direction === "undo") await note.undo();
          else await note.redo();
        } catch (error) {
          console.error("[whiteboard] note history action failed", error);
          orca.notify(
            "error",
            direction === "undo"
              ? t("Could not undo the note change for this action")
              : t("Could not redo the note change for this action"),
          );
          return false;
        }
      }
      const ok = await applySnapshot(target, current);
      if (ok || note == null) return ok;
      try {
        if (direction === "undo") await note.redo();
        else await note.undo();
      } catch (error) {
        console.error(
          "[whiteboard] failed to reverse note action after board restore failed",
          error,
        );
        orca.notify(
          "error",
          t("The note change was applied but the board could not be restored"),
        );
      }
      return false;
    },
    [applySnapshot],
  );

  const onUndo = useCallback(() => {
    if (blockId == null) return;
    const current = snapshotNow();
    const prev = takeUndo(blockId, current);
    if (prev == null) return;
    void applyHistoryTarget(prev, current, "undo").then((ok: boolean) => {
      if (!ok) restoreFailedUndo(blockId, prev);
      bumpHistory();
    });
  }, [applyHistoryTarget, blockId, bumpHistory, snapshotNow]);

  const onRedo = useCallback(() => {
    if (blockId == null) return;
    const current = snapshotNow();
    const next = takeRedo(blockId, current);
    if (next == null) return;
    void applyHistoryTarget(next, current, "redo").then((ok: boolean) => {
      if (!ok) restoreFailedRedo(blockId, next);
      bumpHistory();
    });
  }, [applyHistoryTarget, blockId, bumpHistory, snapshotNow]);

  const onRestoreExtract = useCallback(
    async (cardBlockId: DbId): Promise<boolean> => {
      if (blockId == null) return false;
      const info = readExtractRestore(orca.state.blocks[cardBlockId]);
      if (info == null) {
        orca.notify("info", t("This card can no longer be moved back"));
        return false;
      }
      const current = snapshotNow();
      const next = planBoardAfterRestore<WhiteboardCard, WhiteboardEdge>(
        current.cards,
        current.edges,
        [info],
      );
      const note = invertNoteAction(makeExtractNoteAction([info]));
      recordBefore(blockId, current, note);
      const release = holdHistory();
      let notesRestored = false;
      try {
        await note.redo();
        notesRestored = true;
        const saved = await commitBoard(next.cards, next.edges);
        if (!saved) {
          try {
            await note.undo();
          } catch (rollbackError) {
            console.error(
              "[whiteboard] failed to roll back extract restore",
              rollbackError,
            );
          }
          discardLastRecord(blockId);
          return false;
        }
        bumpHistory();
        return true;
      } catch (error) {
        console.error("[whiteboard] restore extract failed", error);
        if (notesRestored) {
          try {
            await note.undo();
          } catch {
            // already failing
          }
        }
        discardLastRecord(blockId);
        orca.notify(
          "error",
          error instanceof Error
            ? error.message
            : t("Failed to move this card back to the source card"),
        );
        return false;
      } finally {
        release();
      }
    },
    [blockId, bumpHistory, commitBoard, snapshotNow],
  );

  const confirmPlace = useCallback(
    async (value: PlaceDialogValue) => {
      if (busy || blockId == null) return;
      setBusy(true);
      try {
        const result = await placeJournalCards({
          ...value,
          origin: viewportOrigin(view),
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
          setWeekdayGuide(result.weekdayGuide);
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
    onRestoreExtract,
    confirmPlace,
  };
}
