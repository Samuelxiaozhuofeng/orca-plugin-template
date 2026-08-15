import { t } from "../libs/l10n";
import type { WhiteboardArea } from "./areas";
import {
  AREA_CORNERS,
  startResizeArea,
  type AreaCorner,
} from "./areaGestures";
import { cardIntersectsViewport, type CanvasView } from "./viewTransform";

const { useEffect, useRef, useState } = window.React;

type Props = {
  areas: readonly WhiteboardArea[];
  selectedId: string | null;
  view: CanvasView;
  viewportSize: { width: number; height: number };
  ghostRef: { current: HTMLDivElement | null };
  canvasRef: { current: HTMLDivElement | null };
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  onSelect: (id: string | null) => void;
  onRename: (id: string, name: string) => void;
  onResize: (id: string, box: { x: number; y: number; w: number; h: number }) => void;
};

function AreaBox({
  area,
  selected,
  editing,
  canvasRef,
  pointerToWorld,
  onSelect,
  onBeginEdit,
  onCommitName,
  onCancelEdit,
  onResize,
}: {
  area: WhiteboardArea;
  selected: boolean;
  editing: boolean;
  canvasRef: { current: HTMLDivElement | null };
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  onSelect: (id: string) => void;
  onBeginEdit: (id: string) => void;
  onCommitName: (id: string, name: string) => void;
  onCancelEdit: () => void;
  onResize: (id: string, box: { x: number; y: number; w: number; h: number }) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const skipBlurRef = useRef(false);
  const label = area.name.trim() || t("Section");

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
    onSelect(area.id);
  };

  const onTitleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
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

  return (
    <div
      className={selected ? "owb-area is-selected" : "owb-area"}
      data-area-id={area.id}
      style={{ left: area.x, top: area.y, width: area.w, height: area.h }}
    >
      <div
        className="owb-area-title"
        onMouseDown={onTitleMouseDown}
        onClick={onTitleClick}
      >
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
          label
        )}
      </div>
      {selected
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
  );
}

export function AreaLayer({
  areas,
  selectedId,
  view,
  viewportSize,
  ghostRef,
  canvasRef,
  pointerToWorld,
  onSelect,
  onRename,
  onResize,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (editingId != null && !areas.some((area) => area.id === editingId)) {
      setEditingId(null);
    }
  }, [areas, editingId]);

  const visible = areas.filter(
    (area) =>
      area.id === selectedId ||
      area.id === editingId ||
      cardIntersectsViewport(area, view, viewportSize, 0),
  );

  return (
    <div className="owb-area-layer">
      {visible.map((area) => (
        <AreaBox
          key={area.id}
          area={area}
          selected={area.id === selectedId}
          editing={area.id === editingId}
          canvasRef={canvasRef}
          pointerToWorld={pointerToWorld}
          onSelect={onSelect}
          onBeginEdit={setEditingId}
          onCancelEdit={() => setEditingId(null)}
          onCommitName={(id, name) => {
            setEditingId(null);
            onRename(id, name);
          }}
          onResize={onResize}
        />
      ))}
      <div ref={ghostRef} className="owb-area-ghost" hidden />
    </div>
  );
}
