import type { DbId } from "../orca.d.ts";
import {
  startMoveCards,
  startRightButtonSession,
  swallowNextContextMenu,
} from "./cardGestures";
import type { WhiteboardCard } from "./data";
import { startMarquee } from "./marquee";
import { toggleId } from "./selection";
import type { CardRect } from "./selection";
import type { WhiteboardSettings } from "./settings";
import type { CanvasView } from "./viewTransform";

export type CardPatchEntry = {
  blockId: DbId;
  patch: { x?: number; y?: number; w?: number; h?: number };
};

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
  liveView: { current: CanvasView };
};

export function useCanvasPointer(opts: {
  refs: Refs;
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  startPan: (startX: number, startY: number) => void;
  setSelected: (next: DbId[]) => void;
  onPatchCards: (entries: CardPatchEntry[]) => void;
  onMoveFrame?: (boxes: Map<DbId, CardRect>) => void;
}): {
  onViewportMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onCardMouseDown: (
    event: React.MouseEvent<HTMLDivElement>,
    card: WhiteboardCard,
  ) => void;
} {
  const { refs, pointerToWorld, startPan, setSelected, onPatchCards, onMoveFrame } = opts;

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
        if (moves.length === 0) return;
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
      setSelected(next);
    } else if (!next.includes(card.blockId)) {
      next = [card.blockId];
      refs.selected.current = next;
      setSelected(next);
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
    if (target?.closest(".owb-card, .owb-edge-hit, .owb-edge-editor")) return;
    focusViewport();

    const blank = target?.closest(".owb-card, .owb-edge-hit, .owb-edge-editor") == null;
    const spacePan = refs.spaceHeld.current;
    if (
      event.button === 1 ||
      spacePan ||
      (event.button === 0 && event.altKey && blank)
    ) {
      event.preventDefault();
      if (event.button === 2) swallowNextContextMenu();
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
        onDrag: () => startPan(event.clientX, event.clientY),
        onIdleRelease: () =>
          fireAppContextMenu(event.clientX, event.clientY, event.target),
      });
      return;
    }
    if (event.button !== 0 || !blank) return;
    event.preventDefault();
    const viewport = refs.viewport.current;
    const canvas = refs.canvas.current;
    const marquee = refs.marquee.current;
    if (viewport == null || canvas == null || marquee == null) return;
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
      if (event.button === 2) swallowNextContextMenu();
      startPan(event.clientX, event.clientY);
      return;
    }
    if (event.button === 2 && refs.settings.current.mouseScheme === "rightDrag") {
      event.preventDefault();
      event.stopPropagation();
      focusViewport();
      const canMove =
        refs.editing.current !== card.blockId && selectCardOnPointer(card, event);
      if (canMove) beginMoveSelection(event.clientX, event.clientY);
      startRightButtonSession({
        startX: event.clientX,
        startY: event.clientY,
        onIdleRelease: () =>
          fireAppContextMenu(event.clientX, event.clientY, event.target),
      });
      return;
    }
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    focusViewport();

    if (!selectCardOnPointer(card, event)) return;
    if (refs.settings.current.mouseScheme === "rightDrag") return;
    beginMoveSelection(event.clientX, event.clientY);
  };

  return { onViewportMouseDown, onCardMouseDown };
}
