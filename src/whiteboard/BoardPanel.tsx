import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { Canvas, type CanvasView } from "./Canvas";
import {
  boardName,
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

  const onMoveEnd = useCallback(
    async (cardBlockId: DbId, x: number, y: number) => {
      const next = cards.map((card) =>
        card.blockId === cardBlockId ? { ...card, x, y } : card,
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
      <div className="owb-toolbar">
        <div className="owb-toolbar-title">{boardName(block)}</div>
        <orca.components.Button
          variant="soft"
          disabled={busy}
          onClick={() => void placeWeekJournals()}
        >
          {t("Place this week's journals")}
        </orca.components.Button>
        <span className="owb-toolbar-scale">
          {`${Math.round(view.scale * 100)}%`}
        </span>
        <orca.components.Button
          variant="outline"
          onClick={() => setView({ x: 0, y: 0, scale: 1 })}
        >
          {t("Reset view")}
        </orca.components.Button>
      </div>
      <Canvas
        panelId={panelId}
        cards={cards}
        view={view}
        busy={busy}
        onViewChange={setView}
        onMoveEnd={onMoveEnd}
        onPlaceWeek={() => void placeWeekJournals()}
        onViewportWidth={setViewportWidth}
      />
    </div>
  );
}
