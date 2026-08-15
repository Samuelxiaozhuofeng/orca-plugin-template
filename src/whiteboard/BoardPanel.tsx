import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { registerOpenBoard } from "./boards";
import {
  CARD_FOCUS_WAIT_MS,
  takePendingCardFocus,
  type CanvasFocusApi,
} from "./cardFocus";
import { retainBoardHistory } from "./boardHistory";
import { BoardToolbar } from "./BoardToolbar";
import { useBoardPersist } from "./useBoardPersist";
import { formatProtectMessage } from "./boardWrite";
import { areasPropertyPresent, tryReadAreas } from "./areas";
import { tryReadCards, type WhiteboardCard } from "./cards";
import { Canvas } from "./Canvas";
import {
  defaultGridColumns,
  type CanvasOrigin,
} from "./data";
import { tryReadEdges } from "./edges";
import { PlaceDialog } from "./PlaceDialog";
import { useBoardCommands } from "./useBoardCommands";
import {
  flushRememberedView,
  loadRememberedView,
  scheduleRememberedView,
} from "./viewMemory";
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
  const cardsRead = tryReadCards(block);
  const edgesRead = tryReadEdges(block);
  const areasRead = tryReadAreas(block);
  const protect =
    block != null && (!cardsRead.ok || !edgesRead.ok || !areasRead.ok);
  const serverCards = cardsRead.ok ? cardsRead.value : [];
  const serverEdges = edgesRead.ok ? edgesRead.value : [];
  const serverAreas = areasRead.ok ? areasRead.value : [];
  const {
    cards,
    edges,
    areas,
    patchCards,
    commitCards,
    appendCards,
    commitEdges,
    commitAreas,
    commitCardsAndAreas,
    commitBoard,
  } = useBoardPersist(
    blockId ?? null,
    serverCards,
    serverEdges,
    serverAreas,
    protect,
    areasPropertyPresent(block),
  );
  const [view, setView] = useState<CanvasView>(DEFAULT_VIEW);
  const [loadedFor, setLoadedFor] = useState<DbId | null>(null);
  const viewReady = blockId != null && loadedFor === blockId;
  const [busy, setBusy] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [drawArea, setDrawArea] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  // Set when the journal dialog was opened from the canvas context menu, so
  // the cards land where the user right-clicked instead of at the viewport.
  const [placeOrigin, setPlaceOrigin] = useState<CanvasOrigin | null>(null);
  const [weekdayGuide, setWeekdayGuide] = useState<CanvasOrigin | null>(null);
  const [pendingFocus, setPendingFocus] = useState<DbId | null>(null);
  const zoomLabelRef = useRef<HTMLButtonElement | null>(null);
  const focusApiRef = useRef<CanvasFocusApi | null>(null);
  const cardsRef = useRef(cards);
  const edgesRef = useRef(edges);
  const areasRef = useRef(areas);
  cardsRef.current = cards;
  edgesRef.current = edges;
  areasRef.current = areas;

  useEffect(() => {
    setDrawArea(false);
  }, [blockId]);

  const {
    historyTick,
    onPatchCards,
    onAddCards,
    onCommitEdges,
    onRemoveCards,
    onUndo,
    onRedo,
    confirmPlace,
  } = useBoardCommands({
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
    setWeekdayGuide,
    persist: {
      patchCards,
      appendCards,
      commitCards,
      commitEdges,
      commitBoard,
      commitAreas,
      commitCardsAndAreas,
    },
  });

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
    if (pendingFocus == null || !viewReady) return;
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
  }, [cards, pendingFocus, viewReady]);

  useEffect(() => {
    if (pendingFocus == null || !viewReady) return;
    const timer = window.setTimeout(() => {
      orca.notify("info", t("This card is no longer on the board"));
      setPendingFocus(null);
    }, CARD_FOCUS_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [pendingFocus, viewReady]);

  useEffect(() => {
    if (blockId == null) return;
    return retainBoardHistory(blockId);
  }, [blockId]);

  useEffect(() => {
    if (blockId == null) {
      setView(DEFAULT_VIEW);
      setLoadedFor(null);
      return;
    }
    let cancelled = false;
    const settle = (stored: CanvasView | null) => {
      if (cancelled) return;
      setView(stored ?? DEFAULT_VIEW);
      setLoadedFor(blockId);
    };
    // Never leave the panel stuck on the blank pre-restore shell: a rejected
    // read just means "no memory", not "do not render the board".
    void loadRememberedView(blockId).then(settle, () => settle(null));
    return () => {
      cancelled = true;
      flushRememberedView(blockId);
    };
  }, [blockId]);

  const setViewAndRemember = useCallback(
    (next: CanvasView | ((current: CanvasView) => CanvasView)) => {
      setView((current: CanvasView) => {
        const resolved = typeof next === "function" ? next(current) : next;
        if (blockId != null) scheduleRememberedView(blockId, resolved);
        return resolved;
      });
    },
    [blockId],
  );

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

  if (blockId == null) {
    return (
      <div className="owb-panel">
        <div className="owb-empty">{t("Whiteboard not found")}</div>
      </div>
    );
  }

  if (!viewReady) {
    return <div className="owb-panel" />;
  }

  return (
    <div className="owb-panel">
      {protect ? (
        <div className="owb-protect-banner" role="alert">
          {formatProtectMessage(cardsRead, edgesRead, areasRead)}
        </div>
      ) : null}
      <Canvas
        panelId={panelId}
        boardBlockId={blockId}
        cards={cards}
        view={view}
        zoomLabelRef={zoomLabelRef}
        weekdayGuide={weekdayGuide}
        onViewChange={setViewAndRemember}
        onPatchCards={onPatchCards}
        onRemoveCards={onRemoveCards}
        onAddCards={onAddCards}
        edges={edges}
        areas={areas}
        onCommitEdges={onCommitEdges}
        onCommitAreas={commitAreas}
        onCommitCardsAndAreas={commitCardsAndAreas}
        drawArea={drawArea}
        onExitDrawArea={() => setDrawArea(false)}
        onStartDrawArea={() => setDrawArea(true)}
        onUndo={onUndo}
        onRedo={onRedo}
        onViewportWidth={setViewportWidth}
        onPlaceJournalsAt={(origin: CanvasOrigin) => {
          setPlaceOrigin(origin);
          setPlaceOpen(true);
        }}
        focusApiRef={focusApiRef}
      />
      <BoardToolbar
        blockId={blockId}
        block={block}
        historyTick={historyTick}
        busy={busy}
        zoomLabelRef={zoomLabelRef}
        onUndo={onUndo}
        onRedo={onRedo}
        onPlace={() => {
          setPlaceOrigin(null);
          setPlaceOpen(true);
        }}
        onFitView={() => focusApiRef.current?.fitAll() ?? false}
        setView={setViewAndRemember}
      />
      <PlaceDialog
        visible={placeOpen}
        defaultColumns={defaultGridColumns(viewportWidth)}
        submitting={busy}
        onClose={() => {
          if (!busy) setPlaceOpen(false);
        }}
        onConfirm={(value) => void confirmPlace(value, placeOrigin)}
      />
    </div>
  );
}
