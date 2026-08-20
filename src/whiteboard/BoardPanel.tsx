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
import {
  formatProtectMessage,
  hasBoardLayoutProps,
  loadBoardBlock,
} from "./boardWrite";
import { blurCardEditor } from "./cardEditorFlush";
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
import { usePresentation } from "./usePresentation";

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
  const [fetchedFor, setFetchedFor] = useState<DbId | null>(null);
  const serverReady =
    block != null &&
    (hasBoardLayoutProps(block) || fetchedFor === blockId);
  const cardsRead = tryReadCards(block);
  const edgesRead = tryReadEdges(block);
  const areasRead = tryReadAreas(block);
  const protect =
    serverReady && (!cardsRead.ok || !edgesRead.ok || !areasRead.ok);
  const serverCards = serverReady && cardsRead.ok ? cardsRead.value : [];
  const serverEdges = serverReady && edgesRead.ok ? edgesRead.value : [];
  const serverAreas = serverReady && areasRead.ok ? areasRead.value : [];
  const {
    ready: persistReady,
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
    serverReady,
  );
  const [view, setView] = useState<CanvasView>(DEFAULT_VIEW);
  const [loadedFor, setLoadedFor] = useState<DbId | null>(null);
  const viewReady = blockId != null && loadedFor === blockId;
  const [blockError, setBlockError] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [drawArea, setDrawArea] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  // Set when the journal dialog was opened from the canvas context menu, so
  // the cards land where the user right-clicked instead of at the viewport.
  const [placeOrigin, setPlaceOrigin] = useState<CanvasOrigin | null>(null);
  const [pendingFocus, setPendingFocus] = useState<DbId | null>(null);
  const zoomLabelRef = useRef<HTMLButtonElement | null>(null);
  const focusApiRef = useRef<CanvasFocusApi | null>(null);
  const cardsRef = useRef(cards);
  const edgesRef = useRef(edges);
  const areasRef = useRef(areas);
  cardsRef.current = cards;
  edgesRef.current = edges;
  areasRef.current = areas;

  const presentation = usePresentation({
    boardBlockId: blockId,
    areas,
    cards,
    view,
    focusApiRef,
    setView,
    panelRef,
  });
  const presentingRef = useRef(presentation.active);
  presentingRef.current = presentation.active;

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
    if (blockId == null || !serverReady || !persistReady) return;
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
  }, [blockId, onAddCards, persistReady, serverReady]);

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
        if (blockId != null && !presentingRef.current) {
          scheduleRememberedView(blockId, resolved);
        }
        return resolved;
      });
    },
    [blockId],
  );

  useLayoutEffect(() => {
    const el = zoomLabelRef.current;
    if (el) el.textContent = formatZoomPercent(view.scale);
  }, [view.scale]);

  useLayoutEffect(() => {
    return () => {
      blurCardEditor(panelRef.current);
    };
  }, []);

  useEffect(() => {
    if (blockId == null) {
      setBlockError(false);
      setFetchedFor(null);
      return;
    }
    if (hasBoardLayoutProps(orca.state.blocks[blockId])) {
      setBlockError(false);
      setFetchedFor(blockId);
      return;
    }
    setBlockError(false);
    let cancelled = false;
    void loadBoardBlock(blockId)
      .then((loaded: Block | null) => {
        if (cancelled) return;
        if (loaded == null) {
          setBlockError(true);
          orca.notify("error", t("Failed to load whiteboard"));
          return;
        }
        setFetchedFor(blockId);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("[whiteboard] failed to load board block", error);
        orca.notify("error", t("Failed to load whiteboard"));
        setBlockError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [blockId]);

  if (blockId == null) {
    return (
      <div ref={panelRef} className="owb-panel">
        <div className="owb-empty">{t("Whiteboard not found")}</div>
      </div>
    );
  }

  if (blockError && !serverReady) {
    return (
      <div ref={panelRef} className="owb-panel">
        <div className="owb-empty">{t("Failed to load whiteboard")}</div>
      </div>
    );
  }

  if (!viewReady || !serverReady || !persistReady) {
    return (
      <div ref={panelRef} className="owb-panel">
        <div className="owb-empty">{t("Loading whiteboard…")}</div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className={[
        "owb-panel",
        presentation.active ? "is-presenting" : "",
        presentation.reveal != null ? "is-revealing" : "",
        presentation.fullscreenMode === "cover" ? "is-present-cover" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
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
        presenting={presentation.active}
        presentation={presentation}
        presentReveal={presentation.reveal}
      />
      {!presentation.active ? (
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
          slideCount={presentation.slides.length}
          onStartPresent={presentation.start}
        />
      ) : null}
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
