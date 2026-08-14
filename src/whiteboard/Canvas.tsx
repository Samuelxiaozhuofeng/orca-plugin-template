import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  WEEKDAY_LABELS_MON,
  type CanvasOrigin,
  type WhiteboardCard,
} from "./data";
import { JournalCard } from "./JournalCard";
import {
  applyViewToDom,
  CARD_LOD_SCALE,
  clientToWorld,
  finalizeView,
  isPinchZoomEvent,
  normalizeWheelDeltaY,
  scaleFromWheelDelta,
  visibleCards,
  WHEEL_COMMIT_MS,
  type CanvasView,
} from "./viewTransform";

export type { CanvasView };

const { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } =
  window.React;

type Props = {
  panelId: string;
  cards: WhiteboardCard[];
  view: CanvasView;
  busy: boolean;
  zoomLabelRef: { current: HTMLElement | null };
  onViewChange: (view: CanvasView) => void;
  onMoveEnd: (blockId: DbId, x: number, y: number) => void;
  onResizeEnd: (blockId: DbId, w: number, h: number) => void;
  onPlaceWeek: () => void;
  onViewportWidth: (width: number) => void;
  weekdayGuide?: CanvasOrigin | null;
};

type Runtime = {
  gesture: "pan" | "wheel" | null;
  raf: number;
  wheelTimer: number;
};

export function Canvas({
  panelId,
  cards,
  view,
  busy,
  zoomLabelRef,
  onViewChange,
  onMoveEnd,
  onResizeEnd,
  onPlaceWeek,
  onViewportWidth,
  weekdayGuide,
}: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const liveViewRef = useRef(view);
  const committedRef = useRef(view);
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  const [editingId, setEditingId] = useState<DbId | null>(null);
  const [viewportSize, setViewportSize] = useState({
    width: 800,
    height: 600,
  });
  const runtimeRef = useRef<Runtime>({
    gesture: null,
    raf: 0,
    wheelTimer: 0,
  });

  const paint = useCallback(() => {
    applyViewToDom(
      canvasRef.current,
      gridRef.current,
      zoomLabelRef.current,
      liveViewRef.current,
    );
  }, [zoomLabelRef]);

  const schedulePaint = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime.raf !== 0) return;
    runtime.raf = window.requestAnimationFrame(() => {
      runtime.raf = 0;
      paint();
    });
  }, [paint]);

  const commitView = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime.raf !== 0) {
      window.cancelAnimationFrame(runtime.raf);
      runtime.raf = 0;
    }
    if (runtime.wheelTimer !== 0) {
      window.clearTimeout(runtime.wheelTimer);
      runtime.wheelTimer = 0;
    }
    const next = finalizeView(liveViewRef.current, {
      width: viewportRef.current?.clientWidth ?? viewportSize.width,
      height: viewportRef.current?.clientHeight ?? viewportSize.height,
    });
    const prev = committedRef.current;
    liveViewRef.current = next;
    committedRef.current = next;
    runtime.gesture = null;
    viewportRef.current?.classList.remove("is-panning");
    paint();
    if (
      prev.x !== next.x ||
      prev.y !== next.y ||
      prev.scale !== next.scale
    ) {
      onViewChangeRef.current(next);
    }
  }, [paint, viewportSize.height, viewportSize.width]);

  const scheduleWheelCommit = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime.wheelTimer !== 0) window.clearTimeout(runtime.wheelTimer);
    runtime.wheelTimer = window.setTimeout(() => {
      runtime.wheelTimer = 0;
      commitView();
    }, WHEEL_COMMIT_MS);
  }, [commitView]);

  useLayoutEffect(() => {
    const parentChanged =
      view.x !== committedRef.current.x ||
      view.y !== committedRef.current.y ||
      view.scale !== committedRef.current.scale;
    if (runtimeRef.current.gesture != null && !parentChanged) return;
    if (parentChanged && runtimeRef.current.gesture != null) {
      runtimeRef.current.gesture = null;
      if (runtimeRef.current.wheelTimer !== 0) {
        window.clearTimeout(runtimeRef.current.wheelTimer);
        runtimeRef.current.wheelTimer = 0;
      }
    }
    liveViewRef.current = view;
    committedRef.current = view;
    paint();
  }, [paint, view]);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const report = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      onViewportWidth(width);
      setViewportSize((prev: { width: number; height: number }) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onViewportWidth]);

  const wheelRef = useRef<(event: WheelEvent) => void>(() => {});

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (event: WheelEvent) => wheelRef.current(event);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  useEffect(() => {
    return () => {
      const runtime = runtimeRef.current;
      if (runtime.raf !== 0) window.cancelAnimationFrame(runtime.raf);
      if (runtime.wheelTimer !== 0) window.clearTimeout(runtime.wheelTimer);
    };
  }, []);

  const pointerToWorld = useCallback((clientX: number, clientY: number) => {
    return clientToWorld(
      viewportRef.current,
      liveViewRef.current,
      clientX,
      clientY,
    );
  }, []);

  const onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(".owb-card")) return;

    event.preventDefault();
    const runtime = runtimeRef.current;
    if (runtime.wheelTimer !== 0) {
      window.clearTimeout(runtime.wheelTimer);
      runtime.wheelTimer = 0;
    }
    runtime.gesture = "pan";
    viewportRef.current?.classList.add("is-panning");
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = liveViewRef.current;

    const onMove = (moveEvent: MouseEvent) => {
      liveViewRef.current = {
        ...origin,
        x: origin.x + moveEvent.clientX - startX,
        y: origin.y + moveEvent.clientY - startY,
      };
      schedulePaint();
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      commitView();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Wheel must be bound natively: React's synthetic wheel listener is passive,
  // so preventDefault() there is ignored and the host panel scrolls instead.
  const onWheel = (event: WheelEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".owb-card-body")) return;

    const el = viewportRef.current;
    if (!el) return;

    event.preventDefault();
    const runtime = runtimeRef.current;
    runtime.gesture = "wheel";
    const current = liveViewRef.current;

    if (event.ctrlKey || event.metaKey) {
      const rect = el.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const worldX = (mouseX - current.x) / current.scale;
      const worldY = (mouseY - current.y) / current.scale;
      const scale = scaleFromWheelDelta(
        current.scale,
        normalizeWheelDeltaY(event),
        isPinchZoomEvent(event),
      );
      liveViewRef.current = {
        scale,
        x: mouseX - worldX * scale,
        y: mouseY - worldY * scale,
      };
      schedulePaint();
      scheduleWheelCommit();
      return;
    }

    if (event.shiftKey) {
      liveViewRef.current = {
        ...current,
        x: current.x - (event.deltaY || event.deltaX),
      };
    } else {
      liveViewRef.current = {
        ...current,
        x: current.x - event.deltaX,
        y: current.y - event.deltaY,
      };
    }
    schedulePaint();
    scheduleWheelCommit();
  };

  wheelRef.current = onWheel;

  const shownCards = useMemo(
    () => visibleCards(cards, view, viewportSize, editingId),
    [cards, editingId, view, viewportSize],
  );
  const degraded = view.scale < CARD_LOD_SCALE;

  return (
    <orca.components.ContextMenu
      menu={(close) => (
        <orca.components.Menu>
          <orca.components.MenuText
            title={t("Place journals…")}
            disabled={busy}
            onClick={() => {
              close();
              onPlaceWeek();
            }}
          />
        </orca.components.Menu>
      )}
    >
      {(open) => (
        <div
          ref={viewportRef}
          className="owb-viewport"
          onMouseDown={onMouseDown}
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
                pointerToWorld={pointerToWorld}
                onStartEdit={setEditingId}
                onEndEdit={() => setEditingId(null)}
                onMoveEnd={onMoveEnd}
                onResizeEnd={onResizeEnd}
              />
            ))}
          </div>
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
