import { colorIdForDigit } from "./cardBatch.ts";
import { isHostOverlayTarget } from "./hostOverlay.ts";

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return (
    target.closest(
      '.owb-card-editor, .owb-dialog, .owb-card-search, .owb-card-filter, .owb-filter-banner, [contenteditable]:not([contenteditable="false"]), input, textarea',
    ) != null
  );
}

export function isWhiteboardShortcutTarget(
  event: { target: EventTarget | null },
  opts: {
    panelId: string;
    editing: boolean;
    viewport: HTMLElement | null;
    searchOpen?: boolean;
  },
): boolean {
  if (opts.editing) return false;
  if (opts.searchOpen) return false;
  if (orca.state.activePanel !== opts.panelId) return false;
  if (isEditableTarget(event.target)) return false;
  if (isHostOverlayTarget(event.target)) return false;
  const panel = opts.viewport?.closest(".owb-panel");
  const active = document.activeElement;
  if (
    panel != null &&
    active instanceof Node &&
    active !== document.body &&
    !panel.contains(active)
  ) {
    return false;
  }
  return true;
}

export type WhiteboardKeyActions = {
  nudge: (dx: number, dy: number) => void;
  selectAll: () => void;
  escape: () => void;
  remove: () => void;
  undo: () => void;
  redo: () => void;
  find?: () => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  fit?: () => void;
  color?: (id: string | undefined) => void;
  present?: {
    next: () => void;
    prev: () => void;
    nextCard: () => void;
    prevCard: () => void;
    toggleZoom: () => void;
    exit: () => void;
    firstSlide?: () => void;
    lastSlide?: () => void;
  };
};

export type WhiteboardUndoGate = {
  canUndo: boolean;
  canRedo: boolean;
  /** First undo/redo after leaving card edit goes to the host editor. */
  takeHostUndo?: () => boolean;
};

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function handleWhiteboardKey(
  event: KeyboardEvent,
  actions: WhiteboardKeyActions,
  undoGate?: WhiteboardUndoGate,
): boolean {
  if (actions.present != null) {
    if (event.key === "Escape") {
      event.preventDefault();
      actions.present.exit();
      return true;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      actions.present.toggleZoom();
      return true;
    }
    if (
      event.key === "ArrowRight" ||
      event.key === "PageDown" ||
      event.key === " " ||
      event.code === "Space"
    ) {
      event.preventDefault();
      actions.present.next();
      return true;
    }
    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      actions.present.prev();
      return true;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      actions.present.nextCard();
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      actions.present.prevCard();
      return true;
    }
    if (event.key === "Home") {
      event.preventDefault();
      actions.present.firstSlide?.();
      return true;
    }
    if (event.key === "End") {
      event.preventDefault();
      actions.present.lastSlide?.();
      return true;
    }
  }

  if (event.key === "Escape") {
    actions.escape();
    return true;
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    actions.remove();
    return true;
  }
  if (event.metaKey || event.ctrlKey) {
    const key = event.key.toLowerCase();
    if (key === "a") {
      event.preventDefault();
      actions.selectAll();
      return true;
    }
    if (key === "z") {
      const host = undoGate?.takeHostUndo?.() === true;
      if (event.shiftKey) {
        if (host || undoGate?.canRedo === false) return false;
        event.preventDefault();
        actions.redo();
        return true;
      }
      if (host || undoGate?.canUndo === false) return false;
      event.preventDefault();
      actions.undo();
      return true;
    }
    if (key === "y") {
      const host = undoGate?.takeHostUndo?.() === true;
      if (host || undoGate?.canRedo === false) return false;
      event.preventDefault();
      actions.redo();
      return true;
    }
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return false;

  if (
    (event.key === "+" || event.key === "=" || event.code === "NumpadAdd") &&
    actions.zoomIn != null
  ) {
    event.preventDefault();
    actions.zoomIn();
    return true;
  }
  if (
    (event.key === "-" || event.code === "NumpadSubtract") &&
    actions.zoomOut != null
  ) {
    event.preventDefault();
    actions.zoomOut();
    return true;
  }
  if (event.key.toLowerCase() === "f" && actions.fit != null) {
    event.preventDefault();
    actions.fit();
    return true;
  }
  if (actions.color != null && /^[0-5]$/.test(event.key)) {
    const mapped = colorIdForDigit(event.key);
    if (mapped === null) return false;
    event.preventDefault();
    actions.color(mapped);
    return true;
  }

  const step = ARROWS[event.key];
  if (step == null) return false;
  event.preventDefault();
  const size = event.shiftKey ? 10 : 1;
  actions.nudge(step[0] * size, step[1] * size);
  return true;
}
