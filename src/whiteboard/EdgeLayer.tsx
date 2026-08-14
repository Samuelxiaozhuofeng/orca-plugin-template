import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import type { WhiteboardCard } from "./data";
import { curveForBoxes, type CardBox } from "./edgeGeometry";
import {
  paintEdgesForBoxes,
  startDrawEdge,
  type EdgeEls,
} from "./edgeGestures";
import {
  nextEdgeId,
  pairKey,
  type EdgeArrow,
  type Side,
  type WhiteboardEdge,
} from "./edges";
import type { ReferenceEdge } from "./edgeRefs";

const { useLayoutEffect, useRef, useState } = window.React;

export type EdgeLayerApi = {
  startDraw: (card: WhiteboardCard, side: Side, clientX: number, clientY: number) => void;
  onFrame: (boxes: Map<DbId, CardBox>) => void;
};

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
};

type AnyEdge = {
  id: string;
  from: DbId;
  to: DbId;
  fromSide?: Side;
  toSide?: Side;
};

function markerNs(panelId: string): string {
  return `owb${panelId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function bindEl(store: Map<string, EdgeEls>, id: string, key: keyof EdgeEls) {
  return (el: SVGElement | HTMLElement | null) => {
    const rec = store.get(id) ?? {
      visible: null,
      hit: null,
      label: null,
      handleFrom: null,
      handleTo: null,
    };
    rec[key] = el as never;
    store.set(id, rec);
  };
}

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
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const ghostRef = useRef<SVGPathElement | null>(null);
  const elsRef = useRef(new Map<string, EdgeEls>());
  const liveRef = useRef(new Map<DbId, CardBox>());
  const cardsRef = useRef<WhiteboardCard[]>(cards);
  const edgesRef = useRef<WhiteboardEdge[]>(edges);
  const refsRef = useRef<ReferenceEdge[]>(refEdges);
  const commitRef = useRef(onCommit);
  const selectRef = useRef(onSelect);
  const menuEdgeRef = useRef<string | null>(null);
  const skipBlurRef = useRef(false);
  cardsRef.current = cards;
  edgesRef.current = edges;
  refsRef.current = refEdges;
  commitRef.current = onCommit;
  selectRef.current = onSelect;

  const ns = markerNs(panelId);
  const scale = viewScale === 0 ? 1 : viewScale;
  const handleR = 4 / scale;

  const boxMap = () => {
    const map = new Map<DbId, CardBox>();
    for (const card of cardsRef.current) {
      map.set(card.blockId, liveRef.current.get(card.blockId) ?? card);
    }
    return map;
  };

  const allPainted = (): AnyEdge[] => [...edgesRef.current, ...refsRef.current];

  const paintAll = () => {
    paintEdgesForBoxes(allPainted(), boxMap(), (id) => elsRef.current.get(id));
  };

  useLayoutEffect(() => {
    for (const card of cards) {
      const live = liveRef.current.get(card.blockId);
      if (live == null) continue;
      if (
        live.x === card.x &&
        live.y === card.y &&
        live.w === card.w &&
        live.h === card.h
      ) {
        liveRef.current.delete(card.blockId);
      }
    }
  }, [cards]);

  useLayoutEffect(() => {
    paintAll();
  });

  useLayoutEffect(() => {
    const startDraw = (
      card: WhiteboardCard,
      side: Side,
      clientX: number,
      clientY: number,
    ) => {
      const canvas = canvasRef.current;
      const ghost = ghostRef.current;
      if (canvas == null || ghost == null) return;
      const fromBox = liveRef.current.get(card.blockId) ?? card;
      selectRef.current(null);
      startDrawEdge({
        fromId: card.blockId,
        fromSide: side,
        fromBox,
        cards: () =>
          cardsRef.current.map((item: WhiteboardCard) => ({
            blockId: item.blockId,
            ...(liveRef.current.get(item.blockId) ?? item),
          })),
        canvas,
        ghost,
        pointerToWorld,
        occupiedPairs: () =>
          new Set(
            edgesRef.current.map((edge: WhiteboardEdge) =>
              pairKey(edge.from, edge.to),
            ),
          ),
        onComplete: (toId, fromSide) => {
          const current = edgesRef.current;
          void commitRef.current([
            ...current,
            {
              id: nextEdgeId(card.blockId, toId, current),
              from: card.blockId,
              to: toId,
              arrow: "end",
              fromSide,
            },
          ]);
        },
        onCancel: () => {},
      });
    };

    const onFrame = (boxes: Map<DbId, CardBox>) => {
      for (const [id, box] of boxes) liveRef.current.set(id, box);
      const touched = new Set(boxes.keys());
      paintEdgesForBoxes(
        allPainted().filter(
          (edge) => touched.has(edge.from) || touched.has(edge.to),
        ),
        boxMap(),
        (id) => elsRef.current.get(id),
      );
    };

    apiRef.current = { startDraw, onFrame };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, canvasRef, pointerToWorld]);

  const boxes = boxMap();
  const curveOf = (edge: AnyEdge) => {
    const from = boxes.get(edge.from);
    const to = boxes.get(edge.to);
    if (from == null || to == null) return null;
    return curveForBoxes(from, to, edge.fromSide, edge.toSide);
  };

  const markersFor = (kind: "plain" | "ref" | "sel", arrow: EdgeArrow) => {
    const end = arrow === "end" || arrow === "both" ? `url(#${ns}-e-${kind})` : undefined;
    const start = arrow === "both" ? `url(#${ns}-s-${kind})` : undefined;
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

  const edgeMenu = (close: () => void) => {
    const id = menuEdgeRef.current ?? selectedId;
    const edge = edges.find((item) => item.id === id);
    if (edge == null) return null;
    const setArrow = (arrow: EdgeArrow) => {
      close();
      if (edge.arrow === arrow) return;
      void onCommit(
        edges.map((item) => (item.id === edge.id ? { ...item, arrow } : item)),
      );
    };
    return (
      <orca.components.Menu>
        <orca.components.MenuText
          title={t("Arrow to end")}
          preIcon={edge.arrow === "end" ? "ti ti-check" : undefined}
          onClick={() => setArrow("end")}
        />
        <orca.components.MenuText
          title={t("Arrows on both ends")}
          preIcon={edge.arrow === "both" ? "ti ti-check" : undefined}
          onClick={() => setArrow("both")}
        />
        <orca.components.MenuText
          title={t("No arrows")}
          preIcon={edge.arrow === "none" ? "ti ti-check" : undefined}
          onClick={() => setArrow("none")}
        />
        <orca.components.MenuSeparator />
        <orca.components.MenuText
          title={t("Delete")}
          dangerous
          onClick={() => {
            close();
            void onCommit(edges.filter((item) => item.id !== edge.id));
            onSelect(null);
          }}
        />
      </orca.components.Menu>
    );
  };

  const editing = editingId == null
    ? null
    : edges.find((item) => item.id === editingId) ?? null;
  const editingCurve = editing == null ? null : curveOf(editing);

  return (
    <orca.components.ContextMenu menu={edgeMenu}>
      {(open) => (
        <div className="owb-edge-layer">
          <svg className="owb-edges" aria-hidden>
            <defs>
              <ArrowMark id={`${ns}-e-plain`} fill="var(--orca-color-text-2)" scale={scale} />
              <ArrowMark id={`${ns}-s-plain`} fill="var(--orca-color-text-2)" scale={scale} start />
              <ArrowMark id={`${ns}-e-ref`} fill="var(--orca-color-text-3)" scale={scale} />
              <ArrowMark id={`${ns}-s-ref`} fill="var(--orca-color-text-3)" scale={scale} start />
              <ArrowMark id={`${ns}-e-sel`} fill="var(--orca-color-primary-5)" scale={scale} />
              <ArrowMark id={`${ns}-s-sel`} fill="var(--orca-color-primary-5)" scale={scale} start />
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
                    {...markersFor("ref", "end")}
                  />
                </g>
              );
            })}
            {edges.map((edge) => {
              const curve = curveOf(edge);
              if (curve == null) return null;
              const selected = selectedId === edge.id;
              const tone = selected ? "sel" : "plain";
              return (
                <g
                  key={edge.id}
                  className={selected ? "owb-edge is-selected" : "owb-edge"}
                  data-edge-id={edge.id}
                >
                  <path
                    ref={bindEl(elsRef.current, edge.id, "visible")}
                    className="owb-edge-visible"
                    d={curve.d}
                    {...markersFor(tone, edge.arrow)}
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
                      menuEdgeRef.current = edge.id;
                      onSelect(edge.id);
                      open(event);
                    }}
                  />
                  {selected ? (
                    <>
                      <circle
                        ref={bindEl(elsRef.current, edge.id, "handleFrom")}
                        className="owb-edge-handle"
                        cx={curve.p0.x}
                        cy={curve.p0.y}
                        r={handleR}
                      />
                      <circle
                        ref={bindEl(elsRef.current, edge.id, "handleTo")}
                        className="owb-edge-handle"
                        cx={curve.p3.x}
                        cy={curve.p3.y}
                        r={handleR}
                      />
                    </>
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
          </svg>
          <div className="owb-edge-labels">
            {edges.map((edge) => {
              if (edge.label == null || edge.id === editingId) return null;
              const curve = curveOf(edge);
              if (curve == null) return null;
              return (
                <div
                  key={edge.id}
                  ref={bindEl(elsRef.current, edge.id, "label")}
                  className="owb-edge-label"
                  style={{ left: curve.label.x, top: curve.label.y }}
                >
                  {edge.label}
                </div>
              );
            })}
            {editing != null && editingCurve != null ? (
              <input
                className="owb-edge-editor"
                defaultValue={editing.label ?? ""}
                autoFocus
                style={{
                  left: editingCurve.label.x,
                  top: editingCurve.label.y,
                  minWidth: 60,
                }}
                onMouseDown={(event: React.MouseEvent) => event.stopPropagation()}
                onInput={(event: React.FormEvent<HTMLInputElement>) => {
                  const el = event.currentTarget;
                  el.style.width = "60px";
                  el.style.width = `${Math.max(60, el.scrollWidth + 2)}px`;
                }}
                onFocus={(event: React.FocusEvent<HTMLInputElement>) => {
                  const el = event.currentTarget;
                  el.style.width = `${Math.max(60, el.scrollWidth + 2)}px`;
                }}
                onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyLabel(editing.id, event.currentTarget.value);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    skipBlurRef.current = true;
                    setEditingId(null);
                  }
                }}
                onBlur={(event: React.FocusEvent<HTMLInputElement>) => {
                  if (skipBlurRef.current) {
                    skipBlurRef.current = false;
                    return;
                  }
                  applyLabel(editing.id, event.currentTarget.value);
                }}
              />
            ) : null}
          </div>
        </div>
      )}
    </orca.components.ContextMenu>
  );
}
