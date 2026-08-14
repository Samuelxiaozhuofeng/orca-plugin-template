import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { Canvas, type CanvasView } from "./Canvas";
import {
  boardName,
  clampScale,
  fetchWeekJournalCards,
  readCards,
  writeCards,
  type WhiteboardCard,
} from "./data";

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

  const placeWeekJournals = useCallback(async () => {
    if (busy || blockId == null) return;
    setBusy(true);
    try {
      const next = await fetchWeekJournalCards(cards, viewportWidth);
      if (next.length === cards.length) {
        orca.notify("info", t("No journals found for this week"));
        return;
      }
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
        return;
      }
      orca.notify(
        "success",
        t("Added ${count} journal cards", {
          count: String(next.length - cards.length),
        }),
      );
    } catch (error) {
      console.error("[whiteboard] failed to load this week's journals", error);
      orca.notify("error", t("Failed to load this week's journals"));
    } finally {
      setBusy(false);
    }
  }, [blockId, busy, cards, persistCards, viewportWidth]);

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
        onViewChange={setView}
        onMoveEnd={onMoveEnd}
        onResizeEnd={onResizeEnd}
        onPlaceWeek={() => void placeWeekJournals()}
        onViewportWidth={setViewportWidth}
      />
      <div className="owb-toolbar">
        <div className="owb-toolbar-title">{boardName(block)}</div>
        <div className="owb-toolbar-sep" />
        <button
          type="button"
          className="owb-toolbar-btn"
          disabled={busy}
          onClick={() => void placeWeekJournals()}
        >
          {t("Place this week's journals")}
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
    </div>
  );
}
