import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { useCardPersist } from "./cardPersist";
import { Canvas } from "./Canvas";
import {
  boardName,
  clampScale,
  fetchWeekJournalCards,
  readCards,
} from "./data";
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
  const { cards, patchCard, commitCards } = useCardPersist(
    blockId ?? null,
    serverCards,
  );
  const [view, setView] = useState<CanvasView>(DEFAULT_VIEW);
  const [busy, setBusy] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(800);
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

  const onMoveEnd = useCallback(
    (cardBlockId: DbId, x: number, y: number) => {
      patchCard(cardBlockId, { x, y });
    },
    [patchCard],
  );

  const onResizeEnd = useCallback(
    (cardBlockId: DbId, w: number, h: number) => {
      patchCard(cardBlockId, { w, h });
    },
    [patchCard],
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
      const added = next.length - cards.length;
      const saved = await commitCards(next);
      if (!saved) return;
      orca.notify(
        "success",
        t("Added ${count} journal cards", { count: String(added) }),
      );
    } catch (error) {
      console.error("[whiteboard] failed to load this week's journals", error);
      orca.notify("error", t("Failed to load this week's journals"));
    } finally {
      setBusy(false);
    }
  }, [blockId, busy, cards, commitCards, viewportWidth]);

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
        zoomLabelRef={zoomLabelRef}
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
    </div>
  );
}
