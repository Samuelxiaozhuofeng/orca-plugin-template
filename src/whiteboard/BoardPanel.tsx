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
  DEFAULT_VIEW,
  formatZoomPercent,
  type CanvasView,
} from "./viewTransform";

const { useEffect, useLayoutEffect, useRef, useState } = window.React;
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
  const protect = block != null && (!cardsRead.ok || !edgesRead.ok);
  const serverCards = cardsRead.ok ? cardsRead.value : [];
  const serverEdges = edgesRead.ok ? edgesRead.value : [];
  const {
    cards,
    edges,
    patchCards,
    commitCards,
    appendCards,
    commitEdges,
    commitBoard,
  } = useBoardPersist(blockId ?? null, serverCards, serverEdges, protect);
  const [view, setView] = useState<CanvasView>(DEFAULT_VIEW);
  const [busy, setBusy] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(800);
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
  cardsRef.current = cards;
  edgesRef.current = edges;

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
    if (blockId == null) return;
    return retainBoardHistory(blockId);
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
        setView={setView}
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
