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
import {
  isCardBodyClickEdit,
  requestCardEditCaret,
  watchPointerClick,
} from "./cardClickEdit";
import type { WhiteboardCard } from "./data";
import { abortEdgeGestures } from "./edgeGestures";
import { abortMarquees, startMarquee } from "./marquee";
import { toggleId } from "./selection";
import type { CardRect } from "./selection";
import type { WhiteboardSettings } from "./settings";
import {
  cardPointerZone,
  routeCardPointer,
} from "./cardPointerRoute";
import { isEditableTarget } from "./canvasKeys";
import { isHostOverlayTarget } from "./hostOverlay";
import type { CanvasView } from "./viewTransform";

const CANVAS_CHROME =
  ".owb-card, .owb-edge-hit, .owb-edge-editor, .owb-area-title, .owb-area-handle, .owb-area-title-input, .owb-card-search, .owb-selection-bar";

const { useEffect, useRef } = window.React;

export type CardPatchEntry = {
  blockId: DbId;
  patch: {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    color?: string;
    hLock?: true;
  };
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
  onStartEdit: (blockId: DbId) => void;
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
    onStartEdit,
  } = opts;
  const mountedRef = useRef(true);
  const abortCanvasRef = useRef<HTMLElement | null>(null);
  const abortViewportRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (refs.canvas.current) abortCanvasRef.current = refs.canvas.current;
    if (refs.viewport.current) abortViewportRef.current = refs.viewport.current;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortCardGestures(abortCanvasRef.current);
      abortCardGestures(abortViewportRef.current);
      abortMarquees(abortCanvasRef.current);
      abortMarquees(abortViewportRef.current);
      abortEdgeGestures(abortCanvasRef.current);
      abortEdgeGestures(abortViewportRef.current);
      abortAreaGestures(abortCanvasRef.current);
      abortAreaGestures(abortViewportRef.current);
    };
  }, [refs.canvas]);

  const focusViewport = () => {
    refs.viewport.current?.focus({ preventScroll: true });
  };

  const tryClickEdit = (
    card: WhiteboardCard,
    down: React.MouseEvent,
  ): void => {
    if (
      !isCardBodyClickEdit({
        button: down.button,
        shiftKey: down.shiftKey,
        altKey: down.altKey,
        metaKey: down.metaKey,
        ctrlKey: down.ctrlKey,
        clientX: down.clientX,
        clientY: down.clientY,
        target: down.target,
        editing: refs.editing.current === card.blockId,
      })
    ) {
      return;
    }
    const host = refs.canvas.current?.querySelector(
      `[data-block-id="${card.blockId}"]`,
    );
    if (host instanceof HTMLElement && host.classList.contains("is-simplified")) {
      return;
    }
    requestCardEditCaret(card.blockId, down.clientX, down.clientY);
    onStartEdit(card.blockId);
  };

  const beginMoveSelection = (
    startX: number,
    startY: number,
    onClick?: (event: MouseEvent) => void,
  ) => {
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
      onClick,
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
      refs.settings.current.mouseScheme === "mouse"
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
    const route = routeCardPointer({
      button: event.button,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      spaceHeld: refs.spaceHeld.current,
      controlsMode: refs.settings.current.mouseScheme,
      editing: refs.editing.current === card.blockId,
      zone: cardPointerZone(event.target),
    });

    if (route.kind === "ignore") return;

    if (route.kind === "pan") {
      event.preventDefault();
      if (event.button === 2) {
        swallowNextContextMenu(refs.canvas.current ?? refs.viewport.current);
      }
      startPan(event.clientX, event.clientY);
      return;
    }

    if (route.kind === "rightCard") {
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

    if (route.kind === "textSelect") {
      watchPointerClick({
        startX: event.clientX,
        startY: event.clientY,
        onClick: () => {
          if (!mountedRef.current) return;
          tryClickEdit(card, event);
        },
      });
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    focusViewport();
    setSelectedArea(null);
    if (!selectCardOnPointer(card, event)) return;
    const onIdleClick = route.enterEditOnClick
      ? () => {
          if (!mountedRef.current) return;
          tryClickEdit(card, event);
        }
      : undefined;
    beginMoveSelection(event.clientX, event.clientY, onIdleClick);
  };

  return { onViewportMouseDown, onCardMouseDown };
}
