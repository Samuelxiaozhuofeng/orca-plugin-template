import type { SlideOutlineRow } from "./slideOutline.ts";
import { t } from "../libs/l10n";

const { useEffect, useRef, useState } = window.React;

type Props = {
  rows: readonly SlideOutlineRow[];
  onPick: (areaId: string) => void;
  onRemove: (areaId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onClose: () => void;
};

type DragState = {
  pointerId: number;
  startY: number;
  startIndex: number;
  isDragging: boolean;
  element: HTMLElement;
};

export function SlideOutline({
  rows,
  onPick,
  onRemove,
  onReorder,
  onClose,
}: Props) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [indicatorTop, setIndicatorTop] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const onPointerDownRow = (
    index: number,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(".owb-slide-outline-item-remove")) return;

    const currentTarget = event.currentTarget;
    currentTarget.setPointerCapture(event.pointerId);

    dragStateRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startIndex: index,
      isDragging: false,
      element: currentTarget,
    };
  };

  const onPointerMoveRow = (
    index: number,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;

    const deltaY = event.clientY - state.startY;
    if (!state.isDragging) {
      if (Math.abs(deltaY) < 4) return;
      state.isDragging = true;
      setDragFrom(state.startIndex);
    }

    const listEl = listRef.current;
    if (!listEl) return;

    const nodes =
      listEl.querySelectorAll<HTMLElement>(".owb-slide-outline-item");
    if (nodes.length === 0) return;

    let targetIndex = nodes.length - 1;
    for (let i = 0; i < nodes.length; i++) {
      const itemEl = nodes[i];
      const rect = itemEl.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (event.clientY < midY) {
        targetIndex = i;
        break;
      }
    }

    const listRect = listEl.getBoundingClientRect();
    const targetEl = nodes[targetIndex];
    if (targetEl) {
      const targetRect = targetEl.getBoundingClientRect();
      const lineY =
        targetIndex > state.startIndex ? targetRect.bottom : targetRect.top;
      const top = lineY - listRect.top + listEl.scrollTop;
      setIndicatorTop(targetIndex === state.startIndex ? null : top);
    }

    setDropTarget(targetIndex);
  };

  const onPointerUpRow = (
    index: number,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;

    try {
      state.element.releasePointerCapture(event.pointerId);
    } catch {}

    const wasDragging = state.isDragging;
    const startIndex = state.startIndex;
    dragStateRef.current = null;

    setDragFrom(null);
    setDropTarget(null);
    setIndicatorTop(null);

    if (wasDragging) {
      if (dropTarget != null && dropTarget !== startIndex) {
        onReorder(startIndex, dropTarget);
      }
    } else {
      const row = rows[index];
      if (row) onPick(row.areaId);
    }
  };

  const onPointerCancelRow = (
    _index: number,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const state = dragStateRef.current;
    if (state && state.pointerId === event.pointerId) {
      try {
        state.element.releasePointerCapture(event.pointerId);
      } catch {}
      dragStateRef.current = null;
      setDragFrom(null);
      setDropTarget(null);
      setIndicatorTop(null);
    }
  };

  return (
    <div
      className="owb-slide-outline"
      role="dialog"
      aria-label={t("Slideshow outline")}
      onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
    >
      <div className="owb-slide-outline-header">
        <div className="owb-slide-outline-title">
          <i className="ti ti-list-numbers" />
          <span>{t("Slideshow outline")}</span>
        </div>
        <button
          type="button"
          className="owb-slide-outline-close"
          title={t("Close")}
          aria-label={t("Close")}
          onClick={onClose}
        >
          <i className="ti ti-x" />
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="owb-slide-outline-empty">
          {t("Right-click a section to add it to the slideshow")}
        </div>
      ) : (
        <div ref={listRef} className="owb-slide-outline-list" role="listbox">
          {rows.map((row, index) => {
            const name = row.name.trim() || t("Untitled section");
            const cardsLabel = t("${count} cards", {
              count: String(row.cardCount),
            });
            const isDragging = dragFrom === index;
            return (
              <div
                key={row.areaId}
                className={`owb-slide-outline-item${
                  isDragging ? " is-dragging" : ""
                }`}
                role="option"
                aria-selected={false}
                tabIndex={0}
                onPointerDown={(e) => onPointerDownRow(index, e)}
                onPointerMove={(e) => onPointerMoveRow(index, e)}
                onPointerUp={(e) => onPointerUpRow(index, e)}
                onPointerCancel={(e) => onPointerCancelRow(index, e)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPick(row.areaId);
                  }
                }}
              >
                <div
                  className="owb-slide-outline-item-text"
                  title={`${row.number} · ${name} · ${cardsLabel}`}
                >
                  <span className="owb-slide-outline-num">{row.number}</span>
                  <span className="owb-slide-outline-dot"> · </span>
                  <span className="owb-slide-outline-name">{name}</span>
                  <span className="owb-slide-outline-dot"> · </span>
                  <span className="owb-slide-outline-count">{cardsLabel}</span>
                </div>
                <button
                  type="button"
                  className="owb-slide-outline-item-remove"
                  title={t("Remove from slideshow")}
                  aria-label={t("Remove from slideshow")}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(row.areaId);
                  }}
                >
                  <i className="ti ti-x" />
                </button>
              </div>
            );
          })}
          {indicatorTop != null ? (
            <div
              className="owb-slide-outline-indicator"
              style={{ top: `${indicatorTop}px` }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
