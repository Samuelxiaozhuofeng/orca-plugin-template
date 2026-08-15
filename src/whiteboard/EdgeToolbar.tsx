import { t } from "../libs/l10n";
import { COLOR_PRESETS } from "./CardToolbar";
import {
  EDGE_TOOLBAR_EST_HEIGHT,
  EDGE_TOOLBAR_EST_WIDTH,
  nextEdgeToolbarOpen,
  placeEdgeToolbar,
} from "./edgeToolbarLayout";
import {
  planEdgeColor,
  planEdgeStyle,
  type EdgeArrow,
  type WhiteboardEdge,
} from "./edges";

const { useLayoutEffect, useRef, useState } = window.React;

const SWATCHES = [
  ...COLOR_PRESETS.filter((item) => item.id !== "default"),
  ...COLOR_PRESETS.filter((item) => item.id === "default"),
];

type Anchor = { x: number; y: number };

type Props = {
  edge: WhiteboardEdge;
  edges: WhiteboardEdge[];
  anchor: Anchor;
  canvasRef: { current: HTMLDivElement | null };
  viewToken: string;
  onCommit: (next: WhiteboardEdge[]) => Promise<boolean>;
  onDismiss: () => void;
};

function LineGlyph({ dashed }: { dashed?: boolean }) {
  return (
    <svg viewBox="0 0 20 12" width="16" height="10" aria-hidden>
      <line
        x1="1.5"
        y1="6"
        x2="18.5"
        y2="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={dashed ? "3.2 2.6" : undefined}
      />
    </svg>
  );
}

function viewportBox(canvas: HTMLElement | null): DOMRect {
  const host = canvas?.parentElement;
  if (host != null) return host.getBoundingClientRect();
  return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
}

export function EdgeToolbar({
  edge,
  edges,
  anchor,
  canvasRef,
  viewToken,
  onCommit,
  onDismiss,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const bornView = useRef(viewToken);
  const [size, setSize] = useState({
    w: EDGE_TOOLBAR_EST_WIDTH,
    h: EDGE_TOOLBAR_EST_HEIGHT,
  });

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (el == null) return;
    const box = el.getBoundingClientRect();
    if (Math.abs(box.width - size.w) < 0.5 && Math.abs(box.height - size.h) < 0.5) {
      return;
    }
    setSize({ w: box.width, h: box.height });
  });

  useLayoutEffect(() => {
    if (viewToken !== bornView.current) onDismiss();
  }, [onDismiss, viewToken]);

  useLayoutEffect(() => {
    const host = canvasRef.current?.parentElement;
    const onWheel = () => {
      if (!nextEdgeToolbarOpen({ kind: "view-change" })) onDismiss();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!nextEdgeToolbarOpen({ kind: "escape" })) onDismiss();
    };
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (next instanceof Node && rootRef.current?.contains(next)) return;
      if (next instanceof Node && host?.contains(next)) return;
      if (!nextEdgeToolbarOpen({ kind: "panel-blur" })) onDismiss();
    };
    const onDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".owb-edge-toolbar")) {
        return;
      }
      if (host != null && target instanceof Node && host.contains(target)) {
        return;
      }
      if (!nextEdgeToolbarOpen({ kind: "panel-blur" })) onDismiss();
    };
    host?.addEventListener("wheel", onWheel, { capture: true, passive: true });
    host?.addEventListener("focusout", onFocusOut);
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown, true);
    return () => {
      host?.removeEventListener("wheel", onWheel, true);
      host?.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown, true);
    };
  }, [canvasRef, onDismiss]);

  const vp = viewportBox(canvasRef.current);
  const placed = placeEdgeToolbar({
    clickX: anchor.x,
    clickY: anchor.y,
    toolbarWidth: size.w,
    toolbarHeight: size.h,
    viewport: {
      left: vp.left,
      top: vp.top,
      width: vp.width,
      height: vp.height,
    },
  });

  const setColor = (color: string | undefined) => {
    const next = planEdgeColor(edges, edge.id, color);
    if (next == null) return;
    void onCommit(next);
  };

  const setStyle = (style: string | undefined) => {
    const next = planEdgeStyle(edges, edge.id, style);
    if (next == null) return;
    void onCommit(next);
  };

  const setArrow = (arrow: EdgeArrow) => {
    if (edge.arrow === arrow) return;
    void onCommit(
      edges.map((item: WhiteboardEdge) =>
        item.id === edge.id ? { ...item, arrow } : item,
      ),
    );
  };

  const node = (
    <div
      ref={rootRef}
      className="owb-edge-toolbar"
      role="toolbar"
      aria-label={t("Connection style")}
      style={{ left: placed.left - vp.left, top: placed.top - vp.top }}
      onMouseDown={(event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="owb-edge-toolbar-group" role="group" aria-label={t("Line color")}>
        {SWATCHES.map((preset) => {
          const next = preset.id === "default" ? undefined : preset.id;
          const active = (edge.color ?? "default") === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              tabIndex={-1}
              className={[
                "owb-edge-toolbar-dot",
                preset.id === "default" ? "is-default" : `owb-edge-color-${preset.id}`,
                active ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              title={t(preset.label)}
              onClick={() => setColor(next)}
            />
          );
        })}
      </div>
      <div className="owb-edge-toolbar-sep" />
      <div className="owb-edge-toolbar-group" role="group" aria-label={t("Line style")}>
        <button
          type="button"
          tabIndex={-1}
          className={`owb-edge-toolbar-btn${edge.style == null ? " is-active" : ""}`}
          title={t("Solid line")}
          onClick={() => setStyle(undefined)}
        >
          <LineGlyph />
        </button>
        <button
          type="button"
          tabIndex={-1}
          className={`owb-edge-toolbar-btn${edge.style === "dashed" ? " is-active" : ""}`}
          title={t("Dashed line")}
          onClick={() => setStyle("dashed")}
        >
          <LineGlyph dashed />
        </button>
      </div>
      <div className="owb-edge-toolbar-sep" />
      <div className="owb-edge-toolbar-group" role="group" aria-label={t("Arrow to end")}>
        <button
          type="button"
          tabIndex={-1}
          className={`owb-edge-toolbar-btn${edge.arrow === "end" ? " is-active" : ""}`}
          title={t("Arrow to end")}
          onClick={() => setArrow("end")}
        >
          <i className="ti ti-arrow-right" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          className={`owb-edge-toolbar-btn${edge.arrow === "both" ? " is-active" : ""}`}
          title={t("Arrows on both ends")}
          onClick={() => setArrow("both")}
        >
          <i className="ti ti-arrows-horizontal" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          className={`owb-edge-toolbar-btn${edge.arrow === "none" ? " is-active" : ""}`}
          title={t("No arrows")}
          onClick={() => setArrow("none")}
        >
          <i className="ti ti-minus" />
        </button>
      </div>
    </div>
  );

  const host = canvasRef.current?.parentElement;
  if (host == null) return null;
  return window.ReactDOM.createPortal(node, host);
}
