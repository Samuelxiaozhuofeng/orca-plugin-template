import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  WEEKDAY_LABELS_MON,
  clampScale,
  type CanvasOrigin,
  type WhiteboardCard,
} from "./data";
import { JournalCard } from "./JournalCard";

const { useEffect, useRef, useState } = window.React;

export type CanvasView = { x: number; y: number; scale: number };

type Props = {
  panelId: string;
  cards: WhiteboardCard[];
  view: CanvasView;
  busy: boolean;
  onViewChange: (view: CanvasView) => void;
  onMoveEnd: (blockId: DbId, x: number, y: number) => Promise<void>;
  onResizeEnd: (blockId: DbId, w: number, h: number) => Promise<void>;
  onPlaceWeek: () => void;
  onViewportWidth: (width: number) => void;
  weekdayGuide?: CanvasOrigin | null;
};

export function Canvas({
  panelId,
  cards,
  view,
  busy,
  onViewChange,
  onMoveEnd,
  onResizeEnd,
  onPlaceWeek,
  onViewportWidth,
  weekdayGuide,
}: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [panning, setPanning] = useState(false);
  const [editingId, setEditingId] = useState<DbId | null>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const report = () => onViewportWidth(el.clientWidth);
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

  const onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(".owb-card")) return;

    event.preventDefault();
    setPanning(true);
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = viewRef.current;

    const onMove = (moveEvent: MouseEvent) => {
      onViewChange({
        ...origin,
        x: origin.x + moveEvent.clientX - startX,
        y: origin.y + moveEvent.clientY - startY,
      });
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setPanning(false);
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
    const current = viewRef.current;
    if (event.ctrlKey || event.metaKey) {
      const rect = el.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const worldX = (mouseX - current.x) / current.scale;
      const worldY = (mouseY - current.y) / current.scale;
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      const scale = clampScale(current.scale * factor);
      const next = {
        scale,
        x: mouseX - worldX * scale,
        y: mouseY - worldY * scale,
      };
      viewRef.current = next;
      onViewChange(next);
      return;
    }

    if (event.shiftKey) {
      const next = {
        ...current,
        x: current.x - (event.deltaY || event.deltaX),
      };
      viewRef.current = next;
      onViewChange(next);
      return;
    }

    const next = {
      ...current,
      x: current.x - event.deltaX,
      y: current.y - event.deltaY,
    };
    viewRef.current = next;
    onViewChange(next);
  };

  wheelRef.current = onWheel;

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
          className={`owb-viewport${panning ? " is-panning" : ""}`}
          onMouseDown={onMouseDown}
          onContextMenu={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest(".owb-card")) return;
            open(event);
          }}
        >
          <div
            className="owb-grid"
            style={{
              backgroundSize: `${24 * view.scale}px ${24 * view.scale}px`,
              backgroundPosition: `${view.x}px ${view.y}px`,
            }}
          />
          <div
            className="owb-canvas"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            }}
          >
            {/* Future: virtualize cards when a canvas has dozens of them. */}
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
            {cards.map((card) => (
              <JournalCard
                key={`${card.date}-${card.blockId}`}
                panelId={panelId}
                card={card}
                scale={view.scale}
                editing={editingId === card.blockId}
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
