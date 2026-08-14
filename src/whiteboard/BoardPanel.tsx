import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { Canvas, type CanvasView } from "./Canvas";
import {
  boardName,
  clampScale,
  defaultGridColumns,
  placeJournalCards,
  readCards,
  viewportOrigin,
  writeCards,
  type CanvasOrigin,
  type WhiteboardCard,
} from "./data";
import { PlaceDialog, type PlaceDialogValue } from "./PlaceDialog";

const { useCallback, useEffect, useState } = window.React;
const { useSnapshot } = window.Valtio;

type Props = {
  panelId: string;
  blockId?: DbId;
  active?: boolean;
};

export default function BoardPanel({ panelId, blockId }: Props) {
  const { blocks } = useSnapshot(orca.state);
  const block = blockId == null ? undefined : blocks[blockId];
  const cards = readCards(block);
  const [view, setView] = useState<CanvasView>({ x: 0, y: 0, scale: 1 });
  const [busy, setBusy] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [weekdayGuide, setWeekdayGuide] = useState<CanvasOrigin | null>(null);

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

  const persistCards = useCallback(
    async (next: WhiteboardCard[]) => {
      if (blockId == null) {
        throw new Error(t("Failed to save card positions"));
      }
      await writeCards(blockId, next);
    },
    [blockId],
  );

  const persistPatch = useCallback(
    async (cardBlockId: DbId, patch: Partial<WhiteboardCard>) => {
      const next = cards.map((card) =>
        card.blockId === cardBlockId ? { ...card, ...patch } : card,
      );
      try {
        await persistCards(next);
      } catch (error) {
        console.error("[whiteboard] failed to save cards", error);
        orca.notify(
          "error",
          error instanceof Error
            ? error.message
            : t("Failed to save card positions"),
        );
      }
    },
    [cards, persistCards],
  );

  const onMoveEnd = useCallback(
    async (cardBlockId: DbId, x: number, y: number) => {
      await persistPatch(cardBlockId, { x, y });
    },
    [persistPatch],
  );

  const onResizeEnd = useCallback(
    async (cardBlockId: DbId, w: number, h: number) => {
      await persistPatch(cardBlockId, { w, h });
    },
    [persistPatch],
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
          try {
            await persistCards(result.cards);
          } catch (error) {
            console.error("[whiteboard] failed to save cards", error);
            orca.notify(
              "error",
              error instanceof Error
                ? error.message
                : t("Failed to save card positions"),
            );
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
    [blockId, busy, cards, persistCards, view],
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
        cards={cards}
        view={view}
        busy={busy}
        weekdayGuide={weekdayGuide}
        onViewChange={setView}
        onMoveEnd={onMoveEnd}
        onResizeEnd={onResizeEnd}
        onPlaceWeek={() => setPlaceOpen(true)}
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
            onClick={() => setView({ x: 0, y: 0, scale: 1 })}
          >
            {`${Math.round(view.scale * 100)}%`}
          </button>
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
