import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { useCardPersist } from "./cardPersist";
import { Canvas } from "./Canvas";
import {
  boardName,
  clampScale,
  defaultGridColumns,
  placeJournalCards,
  readCards,
  viewportOrigin,
  type CanvasOrigin,
} from "./data";
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
  const [view, setView] = useState<CanvasView>(DEFAULT_VIEW);
  const [busy, setBusy] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [weekdayGuide, setWeekdayGuide] = useState<CanvasOrigin | null>(null);
  const zoomLabelRef = useRef<HTMLButtonElement | null>(null);

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
      const saved = await commitCards(next);
      if (!saved) return false;
      orca.notify(
        "info",
        t(
          "Removed ${count} cards from the board. Journals themselves were not deleted.",
          { count: String(ids.length) },
        ),
      );
      return true;
    },
    [cards, commitCards],
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
          const saved = await commitCards(result.cards);
          if (!saved) return;
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
    [blockId, busy, cards, commitCards, view],
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
        onPatchCards={patchCards}
        onRemoveCards={onRemoveCards}
        onAddCards={appendCards}
        onViewportWidth={setViewportWidth}
      />
      <div className="owb-toolbar">
        <div className="owb-toolbar-title">{boardName(block)}</div>
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
