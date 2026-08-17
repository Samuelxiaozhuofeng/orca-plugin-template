import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  areaCullBox,
  areaIsCollapsed,
  areaVisualBox,
  countCardsInArea,
  sortAreasBackToFront,
  type WhiteboardArea,
} from "./areas";
import {
  AREA_CORNERS,
  startMoveArea,
  startResizeArea,
  type AreaCorner,
} from "./areaGestures";
import { COLOR_PRESETS } from "./CardToolbar";
import type { WhiteboardCard } from "./data";
import { areaChromeFor } from "./useCanvasAreas";
import { cardIntersectsViewport, type CanvasView } from "./viewTransform";

const { useEffect, useRef, useState } = window.React;

type Props = {
  panelId: string;
  areas: readonly WhiteboardArea[];
  selectedIds: readonly string[];
  view: CanvasView;
  viewportSize: { width: number; height: number };
  ghostRef: { current: HTMLDivElement | null };
  canvasRef: { current: HTMLDivElement | null };
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  cards: readonly WhiteboardCard[];
  onSelect: (id: string, opts?: { toggle?: boolean }) => void;
  onRename: (id: string, name: string) => void;
  onResize: (id: string, box: { x: number; y: number; w: number; h: number }) => void;
  onMove: (id: string, dx: number, dy: number) => void;
  onMoveFrame?: (boxes: Map<DbId, { x: number; y: number; w: number; h: number }>) => void;
};

function areaInk(color: string | undefined): string | undefined {
  if (color == null) return undefined;
  const preset = COLOR_PRESETS.find((item) => item.id === color);
  if (preset == null) return undefined;
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(preset.bg);
  return match ? `rgb(${match[1]}, ${match[2]}, ${match[3]})` : undefined;
}

function stopChromePointer(event: React.SyntheticEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

function AreaMenu({
  area,
  onPickColor,
  onAddToSlides,
  onMoveSlideEarlier,
  onMoveSlideLater,
  onRemoveFromSlides,
  close,
}: {
  area: WhiteboardArea;
  onPickColor: (next: string | undefined) => void;
  onAddToSlides: (id: string) => void;
  onMoveSlideEarlier: (id: string) => void;
  onMoveSlideLater: (id: string) => void;
  onRemoveFromSlides: (id: string) => void;
  close: () => void;
}) {
  return (
    <orca.components.Menu>
      <orca.components.MenuTitle title={t("Section color")} />
      {COLOR_PRESETS.map((preset) => {
        const next = preset.id === "default" ? undefined : preset.id;
        const active = (area.color ?? "default") === preset.id;
        return (
          <orca.components.MenuText
            key={preset.id}
            title={t(preset.id === "default" ? "No color" : preset.label)}
            preIcon={active ? "ti ti-check" : "ti ti-point"}
            onClick={() => {
              close();
              onPickColor(next);
            }}
          />
        );
      })}
      <orca.components.MenuSeparator />
      {area.slide != null ? (
        <>
          <orca.components.MenuText
            title={t("Move slide earlier")}
            onClick={() => {
              close();
              onMoveSlideEarlier(area.id);
            }}
          />
          <orca.components.MenuText
            title={t("Move slide later")}
            onClick={() => {
              close();
              onMoveSlideLater(area.id);
            }}
          />
          <orca.components.MenuText
            title={t("Remove from slideshow")}
            onClick={() => {
              close();
              onRemoveFromSlides(area.id);
            }}
          />
        </>
      ) : (
        <orca.components.MenuText
          title={t("Add to slideshow")}
          onClick={() => {
            close();
            onAddToSlides(area.id);
          }}
        />
      )}
    </orca.components.Menu>
  );
}

function AreaBox({
  area,
  selected,
  editing,
  canvasRef,
  pointerToWorld,
  cards,
  onSelect,
  onBeginEdit,
  onCommitName,
  onCancelEdit,
  onResize,
  onMove,
  onMoveFrame,
  onSetColor,
  onToggleCollapsed,
  onAddToSlides,
  onMoveSlide,
  onRemoveFromSlides,
}: {
  area: WhiteboardArea;
  selected: boolean;
  editing: boolean;
  canvasRef: { current: HTMLDivElement | null };
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  cards: readonly WhiteboardCard[];
  onSelect: (id: string, opts?: { toggle?: boolean }) => void;
  onBeginEdit: (id: string) => void;
  onCommitName: (id: string, name: string) => void;
  onCancelEdit: () => void;
  onResize: (id: string, box: { x: number; y: number; w: number; h: number }) => void;
  onMove: (id: string, dx: number, dy: number) => void;
  onMoveFrame?: (boxes: Map<DbId, { x: number; y: number; w: number; h: number }>) => void;
  onSetColor: (id: string, color: string | undefined) => void;
  onToggleCollapsed: (id: string) => void;
  onAddToSlides: (id: string) => void;
  onMoveSlide: (id: string, delta: number) => void;
  onRemoveFromSlides: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const skipBlurRef = useRef(false);
  const bodyRef = useRef(document.body);
  const label = area.name.trim() || t("Section");
  const collapsed = areaIsCollapsed(area);
  const memberCount = countCardsInArea(area, cards);
  const visual = areaVisualBox(area);
  const ink = areaInk(area.color);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (el == null) return;
    el.focus();
    el.select();
  }, [editing]);

  const onTitleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const wasSelected = selected;
    if (additive) {
      onSelect(area.id, { toggle: true });
    } else if (!wasSelected) {
      onSelect(area.id);
    }
    if (editing) return;
    const canvas = canvasRef.current;
    const el = event.currentTarget.parentElement;
    if (canvas == null || el == null) return;
    startMoveArea({
      startX: event.clientX,
      startY: event.clientY,
      area,
      areaEl: el,
      canvas,
      cards,
      pointerToWorld,
      onClick: () => {
        if (!additive && wasSelected) onBeginEdit(area.id);
      },
      onFrame: onMoveFrame,
      onEnd: (dx, dy) => onMove(area.id, dx, dy),
    });
  };

  const onTitleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (editing) return;
    onSelect(area.id);
    onBeginEdit(area.id);
  };

  const onHandleMouseDown = (
    handle: AreaCorner,
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(area.id);
    const canvas = canvasRef.current;
    const el = event.currentTarget.parentElement;
    if (canvas == null || el == null) return;
    startResizeArea({
      handle,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: area.x, y: area.y, w: area.w, h: area.h },
      el,
      canvas,
      pointerToWorld,
      onEnd: (box) => onResize(area.id, box),
    });
  };

  const className = [
    "owb-area",
    selected ? "is-selected" : "",
    collapsed ? "is-collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const style: React.CSSProperties = {
    left: visual.x,
    top: visual.y,
    width: visual.w,
    height: visual.h,
  };
  if (ink != null) {
    (style as Record<string, string>)["--owb-area-ink"] = ink;
  }

  const shownLabel = collapsed
    ? `${label} · ${t("${count} cards", { count: String(memberCount) })}`
    : label;

  return (
    <orca.components.ContextMenu
      container={bodyRef}
      allowBeyondContainer
      menu={(close: () => void) => (
        <AreaMenu
          area={area}
          onPickColor={(next) => onSetColor(area.id, next)}
          onAddToSlides={onAddToSlides}
          onMoveSlideEarlier={(id) => onMoveSlide(id, -1)}
          onMoveSlideLater={(id) => onMoveSlide(id, 1)}
          onRemoveFromSlides={onRemoveFromSlides}
          close={close}
        />
      )}
    >
      {(open: (event: React.UIEvent) => void) => (
        <div
          className={className}
          data-area-id={area.id}
          style={style}
          onContextMenu={(event: React.MouseEvent<HTMLDivElement>) => {
            event.preventDefault();
            event.stopPropagation();
            onSelect(area.id);
            open(event);
          }}
        >
          <div
            className="owb-area-title"
            onMouseDown={onTitleMouseDown}
            onDoubleClick={onTitleDoubleClick}
          >
            {area.slide != null ? (
              <span
                className="owb-area-slide"
                title={t("Slide ${n}", { n: String(area.slide) })}
              >
                {area.slide}
              </span>
            ) : null}
            <button
              type="button"
              className="owb-area-collapse"
              title={collapsed ? t("Expand section") : t("Collapse section")}
              aria-expanded={!collapsed}
              onMouseDown={stopChromePointer}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                stopChromePointer(event);
                onSelect(area.id);
                onToggleCollapsed(area.id);
              }}
            >
              <i className={collapsed ? "ti ti-chevron-right" : "ti ti-chevron-down"} />
            </button>
            {editing ? (
              <input
                ref={inputRef}
                className="owb-area-title-input"
                defaultValue={area.name}
                aria-label={t("Section name")}
                onMouseDown={(event: React.MouseEvent<HTMLInputElement>) => {
                  event.stopPropagation();
                }}
                onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onCommitName(area.id, event.currentTarget.value);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    skipBlurRef.current = true;
                    onCancelEdit();
                  }
                }}
                onBlur={(event: React.FocusEvent<HTMLInputElement>) => {
                  if (skipBlurRef.current) {
                    skipBlurRef.current = false;
                    return;
                  }
                  onCommitName(area.id, event.currentTarget.value);
                }}
              />
            ) : (
              <span className="owb-area-title-text">{shownLabel}</span>
            )}
            <button
              type="button"
              className="owb-area-color"
              title={t("Section color")}
              onMouseDown={stopChromePointer}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                stopChromePointer(event);
                onSelect(area.id);
                open(event);
              }}
            >
              <i className="ti ti-palette" />
            </button>
          </div>
          {selected && !collapsed
            ? AREA_CORNERS.map((handle) => (
                <div
                  key={handle}
                  className={`owb-area-handle owb-area-handle-${handle}`}
                  onMouseDown={(event: React.MouseEvent<HTMLDivElement>) =>
                    onHandleMouseDown(handle, event)
                  }
                />
              ))
            : null}
        </div>
      )}
    </orca.components.ContextMenu>
  );
}

export function AreaLayer({
  panelId,
  areas,
  selectedIds,
  view,
  viewportSize,
  ghostRef,
  canvasRef,
  pointerToWorld,
  cards,
  onSelect,
  onRename,
  onResize,
  onMove,
  onMoveFrame,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const chrome = areaChromeFor(panelId);

  useEffect(() => {
    if (editingId != null && !areas.some((area) => area.id === editingId)) {
      setEditingId(null);
    }
  }, [areas, editingId]);

  const selectedSet = new Set(selectedIds);
  const visible = sortAreasBackToFront(
    areas.filter(
      (area) =>
        selectedSet.has(area.id) ||
        area.id === editingId ||
        cardIntersectsViewport(areaCullBox(area), view, viewportSize, 0),
    ),
  );
  const inv = 1 / Math.max(view.scale, 0.01);

  return (
    <div className="owb-area-layer" style={{ ["--owb-area-inv" as string]: String(inv) }}>
      {visible.map((area) => (
        <AreaBox
          key={area.id}
          area={area}
          selected={selectedSet.has(area.id)}
          editing={area.id === editingId}
          canvasRef={canvasRef}
          pointerToWorld={pointerToWorld}
          cards={cards}
          onSelect={onSelect}
          onBeginEdit={setEditingId}
          onCancelEdit={() => setEditingId(null)}
          onCommitName={(id, name) => {
            setEditingId(null);
            onRename(id, name);
          }}
          onResize={onResize}
          onMove={onMove}
          onMoveFrame={onMoveFrame}
          onSetColor={chrome?.setColor ?? (() => {})}
          onToggleCollapsed={chrome?.toggleCollapsed ?? (() => {})}
          onAddToSlides={chrome?.addToSlides ?? (() => {})}
          onMoveSlide={chrome?.moveSlide ?? (() => {})}
          onRemoveFromSlides={chrome?.removeFromSlides ?? (() => {})}
        />
      ))}
      <div ref={ghostRef} className="owb-area-ghost" hidden />
    </div>
  );
}
