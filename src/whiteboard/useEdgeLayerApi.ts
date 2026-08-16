import type { DbId } from "../orca.d.ts";
import type { WhiteboardCard } from "./data";
import type { CardBox } from "./edgeGeometry";
import {
  startBendHandleDrag,
  startEndpointHandleDrag,
} from "./edgeHandleGestures";
import {
  paintEdgesForBoxes,
  startDrawEdge,
  type BoxedCard,
  type DrawDropEmpty,
  type EdgeEls,
} from "./edgeGestures";
import {
  nextEdgeId,
  pairKey,
  type EdgeBend,
  type Side,
  type WhiteboardEdge,
} from "./edges";
import type { ReferenceEdge } from "./edgeRefs";
import { reconcileLiveBoxes } from "./edgeLiveBoxes";

const { useLayoutEffect, useRef } = window.React;

export type EdgeLayerApi = {
  startDraw: (
    card: WhiteboardCard,
    side: Side | undefined,
    clientX: number,
    clientY: number,
    finishOn?: "mouseup" | "mousedown",
  ) => void;
  onFrame: (boxes: Map<DbId, CardBox>) => void;
  clearGhost: () => void;
  hideToolbar: () => void;
};

export type AnyEdge = {
  id: string;
  from: DbId;
  to: DbId;
  fromSide?: Side;
  toSide?: Side;
  bend?: EdgeBend;
};

export function markerNs(panelId: string): string {
  return `owb${panelId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

export function emptyEdgeEls(): EdgeEls {
  return {
    visible: null,
    hit: null,
    label: null,
    handleFrom: null,
    handleTo: null,
    handleMid: null,
    handleCtrlFrom: null,
    handleCtrlTo: null,
    tangentFrom: null,
    tangentTo: null,
  };
}

export function bindEl(store: Map<string, EdgeEls>, id: string, key: keyof EdgeEls) {
  return (el: SVGElement | HTMLElement | null) => {
    const rec = store.get(id) ?? emptyEdgeEls();
    rec[key] = el as never;
    store.set(id, rec);
  };
}

export function useEdgeLayerApi(opts: {
  cards: WhiteboardCard[];
  edges: WhiteboardEdge[];
  refEdges: ReferenceEdge[];
  canvasRef: { current: HTMLDivElement | null };
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  apiRef: { current: EdgeLayerApi | null };
  onSelect: (id: string | null) => void;
  onCommit: (next: WhiteboardEdge[]) => Promise<boolean>;
  onDropEmpty: (drop: DrawDropEmpty) => void;
  hideToolbar: () => void;
}) {
  const {
    cards,
    edges,
    refEdges,
    canvasRef,
    pointerToWorld,
    apiRef,
    onSelect,
    onCommit,
    onDropEmpty,
    hideToolbar,
  } = opts;
  const ghostRef = useRef<SVGPathElement | null>(null);
  const snapRef = useRef<SVGCircleElement | null>(null);
  const elsRef = useRef(new Map<string, EdgeEls>());
  const liveRef = useRef(new Map<DbId, CardBox>());
  const cardsRef = useRef<WhiteboardCard[]>(cards);
  const edgesRef = useRef<WhiteboardEdge[]>(edges);
  const refsRef = useRef<ReferenceEdge[]>(refEdges);
  const commitRef = useRef(onCommit);
  const selectRef = useRef(onSelect);
  const hideToolbarRef = useRef(hideToolbar);
  const dismissDrawRef = useRef<(() => void) | null>(null);
  const dropEmptyRef = useRef(onDropEmpty);
  dropEmptyRef.current = onDropEmpty;
  cardsRef.current = cards;
  edgesRef.current = edges;
  refsRef.current = refEdges;
  commitRef.current = onCommit;
  selectRef.current = onSelect;
  hideToolbarRef.current = hideToolbar;

  const boxMap = () => {
    const map = new Map<DbId, CardBox>();
    for (const card of cardsRef.current) {
      map.set(card.blockId, liveRef.current.get(card.blockId) ?? card);
    }
    return map;
  };

  const liveCards = (): BoxedCard[] => {
    const boxes = boxMap();
    return cardsRef.current.map((card: WhiteboardCard) => ({
      blockId: card.blockId,
      ...(boxes.get(card.blockId) ?? card),
    }));
  };

  const beginEndpointDrag = (
    edgeId: string,
    which: "from" | "to",
    clientX: number,
    clientY: number,
  ) => {
    const canvas = canvasRef.current;
    if (canvas == null) return;
    startEndpointHandleDrag({
      edgeId,
      which,
      canvas,
      startClientX: clientX,
      startClientY: clientY,
      pointerToWorld,
      getEdges: () => edgesRef.current,
      getCards: liveCards,
      getEls: (id) => elsRef.current.get(id),
      snapEl: snapRef.current,
      onCommit: (next) => {
        void commitRef.current(next);
      },
    });
  };

  const beginBendDrag = (
    edgeId: string,
    which: "mid" | "from" | "to",
    clientX: number,
    clientY: number,
  ) => {
    const canvas = canvasRef.current;
    if (canvas == null) return;
    startBendHandleDrag({
      edgeId,
      which,
      canvas,
      startClientX: clientX,
      startClientY: clientY,
      pointerToWorld,
      getEdges: () => edgesRef.current,
      getCards: liveCards,
      getEls: (id) => elsRef.current.get(id),
      onCommit: (next) => {
        void commitRef.current(next);
      },
    });
  };

  const resetBend = (edgeId: string) => {
    const current = edgesRef.current;
    const edge = current.find((item: WhiteboardEdge) => item.id === edgeId);
    if (edge?.bend == null) return;
    void commitRef.current(
      current.map((item: WhiteboardEdge) => {
        if (item.id !== edgeId) return item;
        const next = { ...item };
        delete next.bend;
        return next;
      }),
    );
  };

  const allPainted = (): AnyEdge[] => [...edgesRef.current, ...refsRef.current];

  const paintAll = () => {
    paintEdgesForBoxes(allPainted(), boxMap(), (id) => elsRef.current.get(id));
  };

  useLayoutEffect(() => {
    reconcileLiveBoxes(liveRef.current, cards);
  }, [cards]);

  useLayoutEffect(() => {
    paintAll();
  });

  useLayoutEffect(() => {
    const startDraw = (
      card: WhiteboardCard,
      side: Side | undefined,
      clientX: number,
      clientY: number,
      finishOn?: "mouseup" | "mousedown",
    ) => {
      const canvas = canvasRef.current;
      const ghost = ghostRef.current;
      if (canvas == null || ghost == null) return;
      dismissDrawRef.current?.();
      const fromBox = liveRef.current.get(card.blockId) ?? card;
      selectRef.current(null);
      const session = startDrawEdge({
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
        finishOn,
        onComplete: (toId, fromSide) => {
          dismissDrawRef.current = null;
          const current = edgesRef.current;
          const next: WhiteboardEdge = {
            id: nextEdgeId(card.blockId, toId, current),
            from: card.blockId,
            to: toId,
            arrow: "end",
          };
          if (fromSide != null) next.fromSide = fromSide;
          void commitRef.current([...current, next]);
        },
        onCancel: () => {
          dismissDrawRef.current = null;
        },
        onDropEmpty: (drop) => {
          dropEmptyRef.current(drop);
        },
      });
      dismissDrawRef.current = session.dismiss;
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

    apiRef.current = {
      startDraw,
      onFrame,
      clearGhost: () => {
        dismissDrawRef.current?.();
        dismissDrawRef.current = null;
      },
      hideToolbar: () => hideToolbarRef.current(),
    };
    return () => {
      dismissDrawRef.current?.();
      dismissDrawRef.current = null;
      apiRef.current = null;
    };
  }, [apiRef, canvasRef, pointerToWorld]);

  return {
    ghostRef,
    snapRef,
    elsRef,
    edgesRef,
    commitRef,
    boxMap,
    beginEndpointDrag,
    beginBendDrag,
    resetBend,
  };
}
