import type { DbId } from "../orca.d.ts";
import { hitAreaAt, type WhiteboardArea } from "./areas";
import {
  abortAreaGestures,
  startDrawArea,
  startMoveArea,
} from "./areaGestures";
import {
  abortCardGestures,
  startMoveCards,
  startRightButtonSession,
  swallowNextContextMenu,
} from "./cardGestures";
import type { WhiteboardCard } from "./data";
import { abortEdgeGestures } from "./edgeGestures";
import { abortMarquees, startMarquee } from "./marquee";
import { toggleId } from "./selection";
import type { CardRect } from "./selection";
import type { WhiteboardSettings } from "./settings";
import { isEditableTarget } from "./canvasKeys";
import { isHostOverlayTarget } from "./hostOverlay";
import type { CanvasView } from "./viewTransform";

const CANVAS_CHROME =
  ".owb-card, .owb-edge-hit, .owb-edge-editor, .owb-area-title, .owb-area-handle, .owb-area-title-input";

const { useEffect, useRef } = window.React;

export type CardPatchEntry = {
  blockId: DbId;
  patch: { x?: number; y?: number; w?: number; h?: number };
};

export type PatchCardsOpts = { record?: boolean };

export type PatchCardsFn = (
  entries: CardPatchEntry[],
  opts?: PatchCardsOpts,
) => void;

type Refs = {
  viewport: { current: HTMLDivElement | null };
  canvas: { current: HTMLDivElement | null };
  marquee: { current: HTMLDivElement | null };
  guides: { current: HTMLDivElement | null };
  spaceHeld: { current: boolean };
  settings: { current: WhiteboardSettings };
  editing: { current: DbId | null };
  selected: { current: DbId[] };
  cards: { current: WhiteboardCard[] };
  areas: { current: WhiteboardArea[] };
  liveView: { current: CanvasView };
  tool: { current: "select" | "drawArea" };
  areaGhost: { current: HTMLDivElement | null };
};

export function useCanvasPointer(opts: {
  refs: Refs;
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  startPan: (startX: number, startY: number) => void;
  setSelected: (next: DbId[]) => void;
  setSelectedArea: (id: string | null) => void;
  onCreateArea: (box: CardRect) => void;
  onExitDrawArea: () => void;
  onPatchCards: PatchCardsFn;
  onMoveArea: (id: string, dx: number, dy: number) => void;
  onMoveFrame?: (boxes: Map<DbId, CardRect>) => void;
}): {
  onViewportMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onCardMouseDown: (
    event: React.MouseEvent<HTMLDivElement>,
    card: WhiteboardCard,
  ) => void;
} {
  const {
    refs,
    pointerToWorld,
    startPan,
    setSelected,
    setSelectedArea,
    onCreateArea,
    onExitDrawArea,
    onPatchCards,
    onMoveArea,
    onMoveFrame,
  } = opts;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const canvas = refs.canvas.current;
      const viewport = refs.viewport.current;
      abortCardGestures(canvas);
      abortCardGestures(viewport);
      abortMarquees(canvas);
      abortMarquees(viewport);
      abortEdgeGestures(canvas);
      abortEdgeGestures(viewport);
      abortAreaGestures(canvas);
      abortAreaGestures(viewport);
    };
  }, [refs.canvas]);

  const focusViewport = () => {
    refs.viewport.current?.focus({ preventScroll: true });
  };

  const beginMoveSelection = (startX: number, startY: number) => {
    const canvas = refs.canvas.current;
    if (canvas == null) return;
    const movingIds = new Set(refs.selected.current);
    const moving = refs.cards.current.filter((item: WhiteboardCard) =>
      movingIds.has(item.blockId),
    );
    if (moving.length === 0) return;
    const others = refs.cards.current.filter(
      (item: WhiteboardCard) => !movingIds.has(item.blockId),
    );
    startMoveCards({
      startX,
      startY,
      canvas,
      guidesEl: refs.guides.current,
      showGuides: () => refs.settings.current.showAlignGuides,
      moving,
      others,
      pointerToWorld,
      view: () => refs.liveView.current,
      onFrame: onMoveFrame,
      onEnd: (moves) => {
        if (!mountedRef.current || moves.length === 0) return;
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
    let next = refs.selected.current;
    if (additive) {
      next = toggleId(next, card.blockId);
      refs.selected.current = next;
      if (mountedRef.current) setSelected(next);
    } else if (!next.includes(card.blockId)) {
      next = [card.blockId];
      refs.selected.current = next;
      if (mountedRef.current) setSelected(next);
    }
    return next.includes(card.blockId);
  };

  const fireAppContextMenu = (
    clientX: number,
    clientY: number,
    target: EventTarget | null,
  ) => {
    const el = target instanceof Element ? target : refs.viewport.current;
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
    if (isHostOverlayTarget(target) || isEditableTarget(target)) return;
    if (target?.closest(CANVAS_CHROME)) return;
    focusViewport();

    const blank = target?.closest(CANVAS_CHROME) == null;
    const spacePan = refs.spaceHeld.current;
    if (
      event.button === 1 ||
      spacePan ||
      (event.button === 0 && event.altKey && blank)
    ) {
      event.preventDefault();
      if (event.button === 2) {
        swallowNextContextMenu(refs.canvas.current ?? refs.viewport.current);
      }
      startPan(event.clientX, event.clientY);
      return;
    }
    if (
      event.button === 2 &&
      blank &&
      refs.settings.current.mouseScheme === "rightDrag"
    ) {
      event.preventDefault();
      startRightButtonSession({
        startX: event.clientX,
        startY: event.clientY,
        root: refs.canvas.current ?? refs.viewport.current,
        onDrag: () => startPan(event.clientX, event.clientY),
        onIdleRelease: () => {
          if (!mountedRef.current) return;
          fireAppContextMenu(event.clientX, event.clientY, event.target);
        },
      });
      return;
    }
    if (event.button !== 0 || !blank) return;
    event.preventDefault();
    const viewport = refs.viewport.current;
    const canvas = refs.canvas.current;
    const marquee = refs.marquee.current;
    if (viewport == null || canvas == null || marquee == null) return;
    if (refs.tool.current === "drawArea") {
      const ghost = refs.areaGhost.current;
      if (ghost == null) return;
      startDrawArea({
        startX: event.clientX,
        startY: event.clientY,
        canvas,
        ghostEl: ghost,
        pointerToWorld,
        onCancel: () => {},
        onEnd: (box) => {
          if (!mountedRef.current) return;
          onCreateArea(box);
          onExitDrawArea();
        },
      });
      return;
    }
    const world = pointerToWorld(event.clientX, event.clientY);
    const areaId = hitAreaAt(world.x, world.y, refs.areas.current);
    if (areaId != null && !event.shiftKey) {
      setSelectedArea(areaId);
      setSelected([]);
      const area = refs.areas.current.find((item) => item.id === areaId);
      const areaEl = canvas.querySelector<HTMLElement>(
        `[data-area-id="${areaId}"]`,
      );
      if (area != null && areaEl != null) {
        startMoveArea({
          startX: event.clientX,
          startY: event.clientY,
          area,
          areaEl,
          canvas,
          cards: refs.cards.current,
          pointerToWorld,
          onClick: () => {},
          onFrame: onMoveFrame,
          onEnd: (dx, dy) => {
            if (!mountedRef.current) return;
            onMoveArea(areaId, dx, dy);
          },
        });
      }
      return;
    }
    setSelectedArea(null);
    startMarquee({
      startX: event.clientX,
      startY: event.clientY,
      additive: event.shiftKey,
      viewport,
      canvas,
      marqueeEl: marquee,
      cards: refs.cards.current,
      selected: refs.selected.current,
      pointerToWorld,
      onCommit: (result) => {
        if (!mountedRef.current) return;
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
    if (event.button === 1 || refs.spaceHeld.current) {
      event.preventDefault();
      if (event.button === 2) {
        swallowNextContextMenu(refs.canvas.current ?? refs.viewport.current);
      }
      startPan(event.clientX, event.clientY);
      return;
    }
    if (event.button === 2 && refs.settings.current.mouseScheme === "rightDrag") {
      event.preventDefault();
      event.stopPropagation();
      focusViewport();
      setSelectedArea(null);
      const canMove =
        refs.editing.current !== card.blockId && selectCardOnPointer(card, event);
      if (canMove) beginMoveSelection(event.clientX, event.clientY);
      startRightButtonSession({
        startX: event.clientX,
        startY: event.clientY,
        root: refs.canvas.current ?? refs.viewport.current,
        onIdleRelease: () => {
          if (!mountedRef.current) return;
          fireAppContextMenu(event.clientX, event.clientY, event.target);
        },
      });
      return;
    }
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    focusViewport();
    setSelectedArea(null);

    if (!selectCardOnPointer(card, event)) return;
    if (refs.settings.current.mouseScheme === "rightDrag") return;
    beginMoveSelection(event.clientX, event.clientY);
  };

  return { onViewportMouseDown, onCardMouseDown };
}
