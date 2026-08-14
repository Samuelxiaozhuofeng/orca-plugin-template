import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { ArrangeMenuItems } from "./ArrangeMenu";
import {
  handleWhiteboardKey,
  isWhiteboardShortcutTarget,
} from "./canvasKeys";
import {
  startMoveCards,
  startRightButtonSession,
  swallowNextContextMenu,
} from "./cardGestures";
import {
  WEEKDAY_LABELS_MON,
  type CanvasOrigin,
  type WhiteboardCard,
} from "./data";
import { Card } from "./Card";
import {
  completeBoardDrop,
  isLeavingDragTarget,
  isOrcaBlockDrag,
} from "./dropBlocks";
import { startMarquee } from "./marquee";
import {
  arrangeCards,
  toggleId,
  type ArrangeAction,
} from "./selection";
import { useWhiteboardSettings } from "./settings";
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
  boardBlockId: DbId;
  cards: WhiteboardCard[];
  view: CanvasView;
  zoomLabelRef: { current: HTMLElement | null };
  onViewChange: (view: CanvasView) => void;
  onPatchCards: (entries: CardPatchEntry[]) => void;
  onRemoveCards: (ids: DbId[]) => Promise<boolean>;
  onAddCards: (cards: WhiteboardCard[]) => Promise<boolean>;
  onViewportWidth: (width: number) => void;
  weekdayGuide?: CanvasOrigin | null;
};

export function Canvas({
  panelId,
  boardBlockId,
  cards,
  view,
  zoomLabelRef,
  onViewChange,
  onPatchCards,
  onRemoveCards,
  onAddCards,
  onViewportWidth,
  weekdayGuide,
}: Props) {
  const [editingId, setEditingId] = useState<DbId | null>(null);
  const [selected, setSelected] = useState<DbId[]>([]);
  const [dropActive, setDropActive] = useState(false);
  const editingRef = useRef<DbId | null>(null);
  const selectedRef = useRef<DbId[]>([]);
  const cardsRef = useRef(cards);
  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const guidesRef = useRef<HTMLDivElement | null>(null);
  const settings = useWhiteboardSettings();
  const settingsRef = useRef(settings);
  editingRef.current = editingId;
  selectedRef.current = selected;
  cardsRef.current = cards;
  settingsRef.current = settings;

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

  const beginMoveSelection = (startX: number, startY: number) => {
    const canvas = canvasRef.current;
    if (canvas == null) return;
    const movingIds = new Set(selectedRef.current);
    const moving = cardsRef.current.filter((item: WhiteboardCard) =>
      movingIds.has(item.blockId),
    );
    if (moving.length === 0) return;
    const others = cardsRef.current.filter(
      (item: WhiteboardCard) => !movingIds.has(item.blockId),
    );
    startMoveCards({
      startX,
      startY,
      canvas,
      guidesEl: guidesRef.current,
      showGuides: () => settingsRef.current.showAlignGuides,
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

  const selectCardOnPointer = (
    card: WhiteboardCard,
    event: React.MouseEvent,
  ): boolean => {
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    let next = selectedRef.current;
    if (additive) {
      next = toggleId(next, card.blockId);
      selectedRef.current = next;
      setSelected(next);
    } else if (!next.includes(card.blockId)) {
      next = [card.blockId];
      selectedRef.current = next;
      setSelected(next);
    }
    return next.includes(card.blockId);
  };

  const fireAppContextMenu = (
    clientX: number,
    clientY: number,
    target: EventTarget | null,
  ) => {
    const el =
      target instanceof Element ? target : viewportRef.current;
    if (el == null) return;
    el.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX,
        clientY,
        button: 2,
      }),
    );
  };

  const onViewportMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".owb-card")) return;
    focusViewport();

    const blank = target?.closest(".owb-card") == null;
    const spacePan = spaceHeldRef.current;
    if (event.button === 1 || spacePan || (event.button === 0 && event.altKey && blank)) {
      event.preventDefault();
      if (event.button === 2) swallowNextContextMenu();
      startPan(event.clientX, event.clientY);
      return;
    }
    if (
      event.button === 2 &&
      blank &&
      settingsRef.current.mouseScheme === "rightDrag"
    ) {
      event.preventDefault();
      startRightButtonSession({
        startX: event.clientX,
        startY: event.clientY,
        onDrag: () => startPan(event.clientX, event.clientY),
        onIdleRelease: () =>
          fireAppContextMenu(event.clientX, event.clientY, event.target),
      });
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
      if (event.button === 2) swallowNextContextMenu();
      startPan(event.clientX, event.clientY);
      return;
    }
    if (event.button === 2 && settingsRef.current.mouseScheme === "rightDrag") {
      event.preventDefault();
      event.stopPropagation();
      focusViewport();
      const canMove =
        editingRef.current !== card.blockId && selectCardOnPointer(card, event);
      if (canMove) beginMoveSelection(event.clientX, event.clientY);
      startRightButtonSession({
        startX: event.clientX,
        startY: event.clientY,
        onIdleRelease: () =>
          fireAppContextMenu(event.clientX, event.clientY, event.target),
      });
      return;
    }
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    focusViewport();

    if (!selectCardOnPointer(card, event)) return;
    if (settingsRef.current.mouseScheme === "rightDrag") return;
    beginMoveSelection(event.clientX, event.clientY);
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

  const canOpenBoardMenu = () => {
    if (selectedRef.current.length >= 2) return true;
    return (
      selectedRef.current.length === 0 && cardsRef.current.length > 0
    );
  };

  const boardMenu = (close: () => void) => (
    <orca.components.Menu>
      {selected.length === 0 && cards.length > 0 ? (
        <orca.components.MenuText
          title={t("Select all")}
          onClick={() => {
            close();
            setSelected(cardsRef.current.map((card: WhiteboardCard) => card.blockId));
          }}
        />
      ) : null}
      <ArrangeMenuItems
        close={close}
        selectedCount={selected.length}
        onArrange={applyArrange}
        leadingSeparator={false}
      />
    </orca.components.Menu>
  );

  return (
    <orca.components.ContextMenu menu={boardMenu}>
      {(open) => (
        <div
          ref={viewportRef}
          className={dropActive ? "owb-viewport is-drop-target" : "owb-viewport"}
          data-mouse-scheme={settings.mouseScheme}
          tabIndex={0}
          onMouseDown={onViewportMouseDown}
          onDragOver={(event) => {
            if (!isOrcaBlockDrag(event.dataTransfer)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setDropActive(true);
          }}
          onDragLeave={(event) => {
            if (isLeavingDragTarget(event.currentTarget, event.relatedTarget)) {
              setDropActive(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDropActive(false);
            const at = pointerToWorld(event.clientX, event.clientY);
            const dataTransfer = event.dataTransfer;
            void completeBoardDrop({
              dataTransfer,
              at,
              existing: cardsRef.current,
              boardBlockId,
              addCards: onAddCards,
            }).catch((error: unknown) => {
              console.error("[whiteboard] failed to drop blocks", error);
              orca.notify(
                "error",
                error instanceof Error
                  ? error.message
                  : t("Failed to add blocks to the board"),
              );
            });
          }}
          onContextMenu={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest(".owb-card")) return;
            if (!canOpenBoardMenu()) {
              event.preventDefault();
              return;
            }
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
              <Card
                key={card.blockId}
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
                {t(
                  "Use the toolbar to place journals, or drag blocks here from a note.",
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </orca.components.ContextMenu>
  );
}
