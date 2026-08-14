import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { ArrangeMenuItems } from "./ArrangeMenu";
import {
  handleWhiteboardKey,
  isWhiteboardShortcutTarget,
} from "./canvasKeys";
import { startMoveCards } from "./cardGestures";
import {
  WEEKDAY_LABELS_MON,
  type CanvasOrigin,
  type WhiteboardCard,
} from "./data";
import { JournalCard } from "./JournalCard";
import { startMarquee } from "./marquee";
import {
  arrangeCards,
  toggleId,
  type ArrangeAction,
} from "./selection";
import { useCanvasView } from "./useCanvasView";
import {
  CARD_LOD_SCALE,
  visibleCards,
  type CanvasView,
} from "./viewTransform";

export type { CanvasView };

export type CardPatchEntry = {
  blockId: DbId;
  patch: { x?: number; y?: number; w?: number; h?: number };
};

const { useCallback, useEffect, useMemo, useRef, useState } = window.React;

type Props = {
  panelId: string;
  cards: WhiteboardCard[];
  view: CanvasView;
  busy: boolean;
  zoomLabelRef: { current: HTMLElement | null };
  onViewChange: (view: CanvasView) => void;
  onPatchCards: (entries: CardPatchEntry[]) => void;
  onRemoveCards: (ids: DbId[]) => Promise<boolean>;
  onPlaceWeek: () => void;
  onViewportWidth: (width: number) => void;
  weekdayGuide?: CanvasOrigin | null;
};

export function Canvas({
  panelId,
  cards,
  view,
  busy,
  zoomLabelRef,
  onViewChange,
  onPatchCards,
  onRemoveCards,
  onPlaceWeek,
  onViewportWidth,
  weekdayGuide,
}: Props) {
  const [editingId, setEditingId] = useState<DbId | null>(null);
  const [selected, setSelected] = useState<DbId[]>([]);
  const editingRef = useRef<DbId | null>(null);
  const selectedRef = useRef<DbId[]>([]);
  const cardsRef = useRef(cards);
  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const guidesRef = useRef<HTMLDivElement | null>(null);
  editingRef.current = editingId;
  selectedRef.current = selected;
  cardsRef.current = cards;

  const {
    viewportRef,
    canvasRef,
    gridRef,
    liveViewRef,
    viewportSize,
    spaceHeldRef,
    pointerToWorld,
    startPan,
  } = useCanvasView({
    panelId,
    view,
    zoomLabelRef,
    onViewChange,
    onViewportWidth,
    isEditing: () => editingRef.current != null,
  });

  useEffect(() => {
    const ids = new Set(cards.map((card: WhiteboardCard) => card.blockId));
    setSelected((prev: DbId[]) => {
      const next = prev.filter((id) => ids.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [cards]);

  const pinned = useMemo(() => {
    const ids = new Set(selected);
    if (editingId != null) ids.add(editingId);
    return ids;
  }, [editingId, selected]);

  const shownCards = useMemo(
    () => visibleCards(cards, view, viewportSize, pinned),
    [cards, pinned, view, viewportSize],
  );
  const degraded = view.scale < CARD_LOD_SCALE;
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const applyArrange = useCallback(
    (action: ArrangeAction) => {
      const ids = new Set<DbId>(selectedRef.current);
      const patches = arrangeCards(action, cardsRef.current, ids, viewportSize.width);
      if (patches.length === 0) return;
      onPatchCards(
        patches.map((item) => ({
          blockId: item.blockId,
          patch: { x: item.x, y: item.y },
        })),
      );
    },
    [onPatchCards, viewportSize.width],
  );

  const startEdit = useCallback((blockId: DbId) => {
    setEditingId(blockId);
    setSelected((prev: DbId[]) => (prev.includes(blockId) ? prev : [blockId]));
  }, []);

  const endEdit = useCallback(() => setEditingId(null), []);

  const focusViewport = () => {
    viewportRef.current?.focus({ preventScroll: true });
  };

  const onViewportMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".owb-card")) return;
    focusViewport();

    const blank = target?.closest(".owb-card") == null;
    const spacePan = spaceHeldRef.current;
    if (event.button === 1 || spacePan || (event.button === 0 && event.altKey && blank)) {
      event.preventDefault();
      startPan(event.clientX, event.clientY);
      return;
    }
    if (event.button !== 0 || !blank) return;
    event.preventDefault();
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    const marquee = marqueeRef.current;
    if (viewport == null || canvas == null || marquee == null) return;
    startMarquee({
      startX: event.clientX,
      startY: event.clientY,
      additive: event.shiftKey,
      viewport,
      canvas,
      marqueeEl: marquee,
      cards: cardsRef.current,
      selected: selectedRef.current,
      pointerToWorld,
      onCommit: (result) => {
        if (result.kind === "click") {
          if (!event.shiftKey) setSelected([]);
          return;
        }
        setSelected(result.ids);
      },
    });
  };

  const onCardMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    card: WhiteboardCard,
  ) => {
    if (event.button === 1 || spaceHeldRef.current) {
      event.preventDefault();
      startPan(event.clientX, event.clientY);
      return;
    }
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    focusViewport();

    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    let next = selectedRef.current;
    if (additive) {
      next = toggleId(next, card.blockId);
      setSelected(next);
    } else if (!next.includes(card.blockId)) {
      next = [card.blockId];
      setSelected(next);
    }
    if (!next.includes(card.blockId)) return;

    const canvas = canvasRef.current;
    if (canvas == null) return;
    const movingIds = new Set(next);
    const moving = cardsRef.current.filter((item: WhiteboardCard) =>
      movingIds.has(item.blockId),
    );
    const others = cardsRef.current.filter(
      (item: WhiteboardCard) => !movingIds.has(item.blockId),
    );
    startMoveCards({
      startX: event.clientX,
      startY: event.clientY,
      canvas,
      guidesEl: guidesRef.current,
      moving,
      others,
      pointerToWorld,
      view: () => liveViewRef.current,
      onEnd: (moves) => {
        if (moves.length === 0) return;
        onPatchCards(
          moves.map((item) => ({
            blockId: item.blockId,
            patch: { x: item.x, y: item.y },
          })),
        );
      },
    });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && editingRef.current != null) {
        setEditingId(null);
        return;
      }
      if (
        !isWhiteboardShortcutTarget(event, {
          panelId,
          editing: editingRef.current != null,
          viewport: viewportRef.current,
        })
      ) {
        return;
      }
      handleWhiteboardKey(event, {
        nudge: (dx, dy) => {
          const ids = new Set<DbId>(selectedRef.current);
          if (ids.size === 0) return;
          const entries: CardPatchEntry[] = [];
          cardsRef.current = cardsRef.current.map((card: WhiteboardCard) => {
            if (!ids.has(card.blockId)) return card;
            const next = { ...card, x: card.x + dx, y: card.y + dy };
            entries.push({
              blockId: card.blockId,
              patch: { x: next.x, y: next.y },
            });
            return next;
          });
          onPatchCards(entries);
        },
        selectAll: () => {
          setSelected(cardsRef.current.map((card: WhiteboardCard) => card.blockId));
        },
        escape: () => setSelected([]),
        remove: () => {
          const ids = selectedRef.current;
          if (ids.length === 0) return;
          void onRemoveCards(ids).then((ok) => {
            if (ok) setSelected([]);
          });
        },
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPatchCards, onRemoveCards, panelId, viewportRef]);

  const boardMenu = (close: () => void) => (
    <orca.components.Menu>
      <orca.components.MenuText
        title={t("Place journals…")}
        disabled={busy}
        onClick={() => {
          close();
          onPlaceWeek();
        }}
      />
      <ArrangeMenuItems
        close={close}
        selectedCount={selected.length}
        onArrange={applyArrange}
      />
    </orca.components.Menu>
  );

  return (
    <orca.components.ContextMenu menu={boardMenu}>
      {(open) => (
        <div
          ref={viewportRef}
          className="owb-viewport"
          tabIndex={0}
          onMouseDown={onViewportMouseDown}
          onContextMenu={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest(".owb-card")) return;
            open(event);
          }}
        >
          <div ref={gridRef} className="owb-grid" />
          <div ref={canvasRef} className="owb-canvas">
            {weekdayGuide != null ? (
              <div
                className="owb-cal-weekdays"
                style={{ left: weekdayGuide.x, top: weekdayGuide.y }}
              >
                {WEEKDAY_LABELS_MON.map((label) => (
                  <div key={label} className="owb-cal-weekday">
                    {label}
                  </div>
                ))}
              </div>
            ) : null}
            {shownCards.map((card: WhiteboardCard) => (
              <JournalCard
                key={`${card.date}-${card.blockId}`}
                panelId={panelId}
                card={card}
                degraded={degraded && editingId !== card.blockId}
                editing={editingId === card.blockId}
                selected={selectedSet.has(card.blockId)}
                showResize={
                  selected.length === 0 ||
                  (selected.length === 1 && selectedSet.has(card.blockId))
                }
                onSelectOnly={(blockId) => setSelected([blockId])}
                selectedCount={selected.length}
                pointerToWorld={pointerToWorld}
                onStartEdit={startEdit}
                onEndEdit={endEdit}
                onCardMouseDown={onCardMouseDown}
                onPatchCard={(blockId, patch) =>
                  onPatchCards([{ blockId, patch }])
                }
                onArrange={applyArrange}
              />
            ))}
          </div>
          <div ref={guidesRef} className="owb-guides" />
          <div ref={marqueeRef} className="owb-marquee" hidden />
          {cards.length === 0 && (
            <div className="owb-canvas-empty">
              <i className="ti ti-layout-grid owb-canvas-empty-icon" />
              <div className="owb-canvas-empty-title">
                {t("This board is empty")}
              </div>
              <div className="owb-canvas-empty-sub">
                {t("Right-click or use the toolbar to place journals.")}
              </div>
            </div>
          )}
        </div>
      )}
    </orca.components.ContextMenu>
  );
}
