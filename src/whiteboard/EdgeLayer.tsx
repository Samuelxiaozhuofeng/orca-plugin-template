import type { WhiteboardCard } from "./data";
import { curveForBoxes, type EdgeCurve } from "./edgeGeometry";
import type { DrawDropEmpty, EdgeEls } from "./edgeGestures";
import { EdgeLabelLayer, EdgeMenuPopup } from "./EdgeOverlay";
import {
  type EdgeArrow,
  type WhiteboardEdge,
} from "./edges";
import type { ReferenceEdge } from "./edgeRefs";
import {
  bindEl,
  markerNs,
  useEdgeLayerApi,
  type AnyEdge,
  type EdgeLayerApi,
} from "./useEdgeLayerApi";

export type { EdgeLayerApi };

const { useRef, useState } = window.React;

type Props = {
  panelId: string;
  cards: WhiteboardCard[];
  edges: WhiteboardEdge[];
  refEdges: ReferenceEdge[];
  viewScale: number;
  selectedId: string | null;
  canvasRef: { current: HTMLDivElement | null };
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  focusViewport: () => void;
  apiRef: { current: EdgeLayerApi | null };
  onSelect: (id: string | null) => void;
  onCommit: (next: WhiteboardEdge[]) => Promise<boolean>;
  onDropEmpty: (drop: DrawDropEmpty) => void;
};

function ArrowMark(props: {
  id: string;
  fill: string;
  scale: number;
  start?: boolean;
}) {
  const size = 10 / (props.scale === 0 ? 1 : props.scale);
  return (
    <marker
      id={props.id}
      viewBox="0 0 10 10"
      refX="8"
      refY="5"
      markerWidth={size}
      markerHeight={size}
      markerUnits="userSpaceOnUse"
      orient={props.start ? "auto-start-reverse" : "auto"}
    >
      <path d="M 0 1 L 10 5 L 0 9 z" fill={props.fill} />
    </marker>
  );
}

function stopHandleDown(event: React.MouseEvent): boolean {
  if (event.button !== 0) return false;
  event.preventDefault();
  event.stopPropagation();
  return true;
}

function SelectedHandles(props: {
  edgeId: string;
  curve: EdgeCurve;
  els: Map<string, EdgeEls>;
  handleR: number;
  midR: number;
  ctrlR: number;
  onEndpointDown: (which: "from" | "to", event: React.MouseEvent) => void;
  onBendDown: (which: "mid" | "from" | "to", event: React.MouseEvent) => void;
  onMidDoubleClick: (event: React.MouseEvent) => void;
}) {
  const { edgeId, curve, els, handleR, midR, ctrlR } = props;
  return (
    <>
      <line
        ref={bindEl(els, edgeId, "tangentFrom")}
        className="owb-edge-tangent"
        x1={curve.p0.x}
        y1={curve.p0.y}
        x2={curve.p1.x}
        y2={curve.p1.y}
      />
      <line
        ref={bindEl(els, edgeId, "tangentTo")}
        className="owb-edge-tangent"
        x1={curve.p3.x}
        y1={curve.p3.y}
        x2={curve.p2.x}
        y2={curve.p2.y}
      />
      <circle
        ref={bindEl(els, edgeId, "handleCtrlFrom")}
        className="owb-edge-handle owb-edge-handle-ctrl"
        cx={curve.p1.x}
        cy={curve.p1.y}
        r={ctrlR}
        onMouseDown={(event: React.MouseEvent) => {
          if (!stopHandleDown(event)) return;
          props.onBendDown("from", event);
        }}
      />
      <circle
        ref={bindEl(els, edgeId, "handleCtrlTo")}
        className="owb-edge-handle owb-edge-handle-ctrl"
        cx={curve.p2.x}
        cy={curve.p2.y}
        r={ctrlR}
        onMouseDown={(event: React.MouseEvent) => {
          if (!stopHandleDown(event)) return;
          props.onBendDown("to", event);
        }}
      />
      <circle
        ref={bindEl(els, edgeId, "handleMid")}
        className="owb-edge-handle owb-edge-handle-mid"
        cx={curve.label.x}
        cy={curve.label.y}
        r={midR}
        onMouseDown={(event: React.MouseEvent) => {
          if (!stopHandleDown(event)) return;
          props.onBendDown("mid", event);
        }}
        onDoubleClick={(event: React.MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          props.onMidDoubleClick(event);
        }}
      />
      <circle
        ref={bindEl(els, edgeId, "handleFrom")}
        className="owb-edge-handle owb-edge-handle-end"
        cx={curve.p0.x}
        cy={curve.p0.y}
        r={handleR}
        onMouseDown={(event: React.MouseEvent) => {
          if (!stopHandleDown(event)) return;
          props.onEndpointDown("from", event);
        }}
      />
      <circle
        ref={bindEl(els, edgeId, "handleTo")}
        className="owb-edge-handle owb-edge-handle-end"
        cx={curve.p3.x}
        cy={curve.p3.y}
        r={handleR}
        onMouseDown={(event: React.MouseEvent) => {
          if (!stopHandleDown(event)) return;
          props.onEndpointDown("to", event);
        }}
      />
    </>
  );
}

export function EdgeLayer({
  panelId,
  cards,
  edges,
  refEdges,
  viewScale,
  selectedId,
  canvasRef,
  pointerToWorld,
  focusViewport,
  apiRef,
  onSelect,
  onCommit,
  onDropEmpty,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuAt, setMenuAt] = useState<
    { edgeId: string; x: number; y: number } | null
  >(null);
  const skipBlurRef = useRef(false);
  const {
    ghostRef,
    snapRef,
    elsRef,
    edgesRef,
    commitRef,
    boxMap,
    beginEndpointDrag,
    beginBendDrag,
    resetBend,
  } = useEdgeLayerApi({
    cards,
    edges,
    refEdges,
    canvasRef,
    pointerToWorld,
    apiRef,
    onSelect,
    onCommit,
    onDropEmpty,
  });

  const ns = markerNs(panelId);
  const scale = viewScale === 0 ? 1 : viewScale;
  const handleR = 4 / scale;
  const midR = 7 / scale;
  const ctrlR = 4.5 / scale;
  const snapR = 10 / scale;

  const boxes = boxMap();
  const curveOf = (edge: AnyEdge) => {
    const from = boxes.get(edge.from);
    const to = boxes.get(edge.to);
    if (from == null || to == null) return null;
    return curveForBoxes(from, to, edge.fromSide, edge.toSide, edge.bend);
  };

  const markersFor = (arrow: EdgeArrow) => {
    const end = arrow === "end" || arrow === "both" ? `url(#${ns}-e)` : undefined;
    const start = arrow === "both" ? `url(#${ns}-s)` : undefined;
    return { markerEnd: end, markerStart: start };
  };

  const beginEdit = (id: string) => {
    skipBlurRef.current = false;
    setEditingId(id);
    onSelect(id);
  };

  const applyLabel = (id: string, raw: string) => {
    setEditingId(null);
    const label = raw.trim();
    const current = edgesRef.current;
    const edge = current.find((item: WhiteboardEdge) => item.id === id);
    if (edge == null) return;
    const prev = edge.label ?? "";
    if (prev === label) return;
    void commitRef.current(
      current.map((item: WhiteboardEdge) => {
        if (item.id !== id) return item;
        if (label === "") {
          const next = { ...item };
          delete next.label;
          return next;
        }
        return { ...item, label };
      }),
    );
  };

  // Anchored at the cursor rather than at the <path>: the context-menu
  // component positions against HTML box metrics, which SVG elements do
  // not have, so anchoring to the line itself never opens.
  const menuEdge =
    menuAt == null ? null : edges.find((item) => item.id === menuAt.edgeId);
  const closeMenu = () => setMenuAt(null);

  const editing = editingId == null
    ? null
    : edges.find((item) => item.id === editingId) ?? null;
  const editingCurve = editing == null ? null : curveOf(editing);

  return (
    <>
      <EdgeMenuPopup
        menuAt={menuAt}
        menuEdge={menuEdge ?? null}
        edges={edges}
        onCommit={onCommit}
        onSelect={onSelect}
        onClose={closeMenu}
      />
      <div className="owb-edge-layer">
          <svg className="owb-edges" aria-hidden>
            <defs>
              <ArrowMark id={`${ns}-e`} fill="context-stroke" scale={scale} />
              <ArrowMark id={`${ns}-s`} fill="context-stroke" scale={scale} start />
            </defs>
            {refEdges.map((edge) => {
              const curve = curveOf(edge);
              if (curve == null) return null;
              return (
                <g key={edge.id} className="owb-edge is-ref" data-edge-id={edge.id}>
                  <path
                    ref={bindEl(elsRef.current, edge.id, "visible")}
                    className="owb-edge-visible"
                    d={curve.d}
                    {...markersFor("end")}
                  />
                </g>
              );
            })}
            {edges.map((edge) => {
              const curve = curveOf(edge);
              if (curve == null) return null;
              const selected = selectedId === edge.id;
              const className = [
                "owb-edge",
                selected ? "is-selected" : "",
                edge.linked ? "is-linked" : "",
                edge.color ? `owb-edge-color-${edge.color}` : "",
                edge.style === "dashed" ? "is-dashed" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <g
                  key={edge.id}
                  className={className}
                  data-edge-id={edge.id}
                >
                  <path
                    ref={bindEl(elsRef.current, edge.id, "visible")}
                    className="owb-edge-visible"
                    d={curve.d}
                    {...markersFor(edge.arrow)}
                  />
                  <path
                    ref={bindEl(elsRef.current, edge.id, "hit")}
                    className="owb-edge-hit"
                    d={curve.d}
                    onMouseDown={(event: React.MouseEvent) => {
                      if (event.button !== 0) return;
                      event.preventDefault();
                      event.stopPropagation();
                      focusViewport();
                      onSelect(edge.id);
                    }}
                    onDoubleClick={(event: React.MouseEvent) => {
                      event.preventDefault();
                      event.stopPropagation();
                      beginEdit(edge.id);
                    }}
                    onContextMenu={(event: React.MouseEvent) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onSelect(edge.id);
                      setMenuAt({
                        edgeId: edge.id,
                        x: event.clientX,
                        y: event.clientY,
                      });
                    }}
                  />
                  {selected ? (
                    <SelectedHandles
                      edgeId={edge.id}
                      curve={curve}
                      els={elsRef.current}
                      handleR={handleR}
                      midR={midR}
                      ctrlR={ctrlR}
                      onEndpointDown={(which, event) => {
                        focusViewport();
                        beginEndpointDrag(
                          edge.id,
                          which,
                          event.clientX,
                          event.clientY,
                        );
                      }}
                      onBendDown={(which, event) => {
                        focusViewport();
                        beginBendDrag(
                          edge.id,
                          which,
                          event.clientX,
                          event.clientY,
                        );
                      }}
                      onMidDoubleClick={() => {
                        resetBend(edge.id);
                      }}
                    />
                  ) : null}
                </g>
              );
            })}
            <path
              ref={ghostRef}
              className="owb-edge-ghost"
              visibility="hidden"
              d=""
            />
            <circle
              ref={snapRef}
              className="owb-edge-snap"
              visibility="hidden"
              cx="0"
              cy="0"
              r={snapR}
            />
          </svg>
          <EdgeLabelLayer
            edges={edges}
            editingId={editingId}
            editing={editing}
            editingCurve={editingCurve}
            els={elsRef.current}
            curveOf={curveOf}
            applyLabel={applyLabel}
            skipBlurRef={skipBlurRef}
            setEditingId={setEditingId}
          />
      </div>
    </>
  );
}
