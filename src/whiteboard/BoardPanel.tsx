import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { registerOpenBoard } from "./boards";
import {
  CARD_FOCUS_WAIT_MS,
  takePendingCardFocus,
  type CanvasFocusApi,
} from "./cardFocus";
import {
  canRedo,
  canUndo,
  cardPatchesChange,
  clearBoardHistory,
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
import { useCardPersist } from "./cardPersist";
import { Canvas } from "./Canvas";
import {
  boardName,
  cardsEqual,
  clampScale,
  defaultGridColumns,
  edgesEqual,
  placeJournalCards,
  readCards,
  readEdges,
  viewportOrigin,
  type CanvasOrigin,
  type WhiteboardCard,
} from "./data";
import { useEdgePersist } from "./edgePersist";
import type { WhiteboardEdge } from "./edges";
import { PlaceDialog, type PlaceDialogValue } from "./PlaceDialog";
import {
  DEFAULT_VIEW,
  formatZoomPercent,
  type CanvasView,
} from "./viewTransform";

const { useCallback, useEffect, useLayoutEffect, useRef, useState } =
  window.React;
const { useSnapshot } = window.Valtio;

type Props = {
  panelId: string;
  blockId?: DbId;
  active?: boolean;
};

export default function BoardPanel({ panelId, blockId }: Props) {
  const { blocks } = useSnapshot(orca.state);
  const block = blockId == null ? undefined : blocks[blockId];
  const serverCards = readCards(block);
  const { cards, patchCards, commitCards, appendCards } = useCardPersist(
    blockId ?? null,
    serverCards,
  );
  const serverEdges = readEdges(block, cards);
  const { edges, commitEdges } = useEdgePersist(
    blockId ?? null,
    serverEdges,
    cards.map((card) => card.blockId),
  );
  const [view, setView] = useState<CanvasView>(DEFAULT_VIEW);
  const [busy, setBusy] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [weekdayGuide, setWeekdayGuide] = useState<CanvasOrigin | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const [pendingFocus, setPendingFocus] = useState<DbId | null>(null);
  const zoomLabelRef = useRef<HTMLButtonElement | null>(null);
  const focusApiRef = useRef<CanvasFocusApi | null>(null);
  const cardsRef = useRef(cards);
  const edgesRef = useRef(edges);
  cardsRef.current = cards;
  edgesRef.current = edges;

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
        patch: { x?: number; y?: number; w?: number; h?: number };
      }>,
    ) => {
      if (cardPatchesChange(cardsRef.current, entries)) record();
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

  useEffect(() => {
    if (blockId == null) return;
    return registerOpenBoard(blockId, {
      getCards: () => cardsRef.current,
      appendCards: onAddCards,
      focusCard: (cardBlockId: DbId) => {
        if (
          !cardsRef.current.some(
            (card: WhiteboardCard) => card.blockId === cardBlockId,
          )
        ) {
          return false;
        }
        return focusApiRef.current?.focusCard(cardBlockId) ?? false;
      },
    });
  }, [blockId, onAddCards]);

  useEffect(() => {
    if (blockId == null) {
      setPendingFocus(null);
      return;
    }
    setPendingFocus(takePendingCardFocus(blockId));
  }, [blockId]);

  useEffect(() => {
    if (pendingFocus == null) return;
    if (
      !cards.some((card: WhiteboardCard) => card.blockId === pendingFocus)
    ) {
      return;
    }
    const ok = focusApiRef.current?.focusCard(pendingFocus) ?? false;
    setPendingFocus(null);
    if (!ok) {
      orca.notify("info", t("This card is no longer on the board"));
    }
  }, [cards, pendingFocus]);

  useEffect(() => {
    if (pendingFocus == null) return;
    const timer = window.setTimeout(() => {
      orca.notify("info", t("This card is no longer on the board"));
      setPendingFocus(null);
    }, CARD_FOCUS_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [pendingFocus]);

  useEffect(() => {
    return () => {
      if (blockId != null) clearBoardHistory(blockId);
    };
  }, [blockId]);

  useLayoutEffect(() => {
    const el = zoomLabelRef.current;
    if (el) el.textContent = formatZoomPercent(view.scale);
  }, [view.scale]);

  useEffect(() => {
    if (blockId == null || orca.state.blocks[blockId]) return;
    let cancelled = false;
    void orca
      .invokeBackend("get-block", blockId)
      .then((loaded: Block | null) => {
        if (cancelled || loaded == null) return;
        orca.state.blocks[loaded.id] = loaded;
      })
      .catch((error: unknown) => {
        console.error("[whiteboard] failed to load board block", error);
        orca.notify("error", t("Failed to load whiteboard"));
      });
    return () => {
      cancelled = true;
    };
  }, [blockId]);

  const onRemoveCards = useCallback(
    async (ids: DbId[]): Promise<boolean> => {
      if (ids.length === 0) return true;
      const drop = new Set(ids);
      const next = cards.filter((card) => !drop.has(card.blockId));
      record();
      const release = holdHistory();
      try {
        const saved = await commitCards(next);
        if (!saved) {
          if (blockId != null) discardLastRecord(blockId);
          return false;
        }
        const leftover = edges.filter(
          (edge) => !drop.has(edge.from) && !drop.has(edge.to),
        );
        if (leftover.length !== edges.length) {
          const edgesOk = await commitEdges(
            leftover,
            new Set(next.map((card) => card.blockId)),
          );
          if (!edgesOk) return false;
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
    [blockId, cards, commitCards, commitEdges, edges, record],
  );

  const applySnapshot = useCallback(
    async (next: BoardSnapshot, current: BoardSnapshot): Promise<boolean> => {
      const nextEdges = preserveLinked(next.edges, current.edges);
      const cardsChanged = !cardsEqual(next.cards, current.cards);
      const edgesChanged = !edgesEqual(nextEdges, current.edges);
      if (cardsChanged) {
        const ok = await commitCards(next.cards);
        if (!ok) return false;
      }
      if (edgesChanged) {
        const ok = await commitEdges(
          nextEdges,
          new Set(next.cards.map((card) => card.blockId)),
        );
        if (!ok) {
          if (cardsChanged) await commitCards(current.cards);
          return false;
        }
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
    [blockId, commitCards, commitEdges],
  );

  const onUndo = useCallback(() => {
    if (blockId == null) return;
    const current = snapshotNow();
    const prev = takeUndo(blockId, current);
    if (prev == null) return;
    void applySnapshot(prev, current).then((ok: boolean) => {
      if (!ok) restoreFailedUndo(blockId);
      bumpHistory();
    });
  }, [applySnapshot, blockId, bumpHistory, snapshotNow]);

  const onRedo = useCallback(() => {
    if (blockId == null) return;
    const current = snapshotNow();
    const next = takeRedo(blockId, current);
    if (next == null) return;
    void applySnapshot(next, current).then((ok: boolean) => {
      if (!ok) restoreFailedRedo(blockId);
      bumpHistory();
    });
  }, [applySnapshot, blockId, bumpHistory, snapshotNow]);

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

  if (blockId == null) {
    return (
      <div className="owb-panel">
        <div className="owb-empty">{t("Whiteboard not found")}</div>
      </div>
    );
  }

  return (
    <div className="owb-panel">
      <Canvas
        panelId={panelId}
        boardBlockId={blockId}
        cards={cards}
        view={view}
        zoomLabelRef={zoomLabelRef}
        weekdayGuide={weekdayGuide}
        onViewChange={setView}
        onPatchCards={onPatchCards}
        onRemoveCards={onRemoveCards}
        onAddCards={onAddCards}
        edges={edges}
        onCommitEdges={onCommitEdges}
        onUndo={onUndo}
        onRedo={onRedo}
        onViewportWidth={setViewportWidth}
        focusApiRef={focusApiRef}
      />
      <div className="owb-toolbar">
        <div className="owb-toolbar-title">{boardName(block)}</div>
        <div className="owb-toolbar-sep" />
        <button
          type="button"
          className="owb-toolbar-btn"
          disabled={historyTick < 0 || !canUndo(blockId)}
          title={t("Undo")}
          onClick={onUndo}
        >
          <i className="ti ti-arrow-back-up" />
        </button>
        <button
          type="button"
          className="owb-toolbar-btn"
          disabled={historyTick < 0 || !canRedo(blockId)}
          title={t("Redo")}
          onClick={onRedo}
        >
          <i className="ti ti-arrow-forward-up" />
        </button>
        <div className="owb-toolbar-sep" />
        <button
          type="button"
          className="owb-toolbar-btn"
          disabled={busy}
          onClick={() => setPlaceOpen(true)}
        >
          {t("Place journals…")}
        </button>
        <div className="owb-toolbar-sep" />
        <div className="owb-zoom">
          <button
            type="button"
            className="owb-zoom-btn"
            onClick={() =>
              setView((current: CanvasView) => ({
                ...current,
                scale: clampScale(current.scale / 1.1),
              }))
            }
          >
            −
          </button>
          <div className="owb-zoom-sep" />
          <button
            type="button"
            className="owb-zoom-btn"
            ref={zoomLabelRef}
            title={t("Reset view")}
            onClick={() => setView(DEFAULT_VIEW)}
          />
          <div className="owb-zoom-sep" />
          <button
            type="button"
            className="owb-zoom-btn"
            onClick={() =>
              setView((current: CanvasView) => ({
                ...current,
                scale: clampScale(current.scale * 1.1),
              }))
            }
          >
            +
          </button>
        </div>
      </div>
      <PlaceDialog
        visible={placeOpen}
        defaultColumns={defaultGridColumns(viewportWidth)}
        submitting={busy}
        onClose={() => {
          if (!busy) setPlaceOpen(false);
        }}
        onConfirm={(value) => void confirmPlace(value)}
      />
    </div>
  );
}
