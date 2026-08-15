export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return (
    target.closest(
      '.owb-card-editor, .owb-dialog, [contenteditable="true"], input, textarea',
    ) != null
  );
}

export function isWhiteboardShortcutTarget(
  event: KeyboardEvent,
  opts: {
    panelId: string;
    editing: boolean;
    viewport: HTMLElement | null;
  },
): boolean {
  if (opts.editing) return false;
  if (orca.state.activePanel !== opts.panelId) return false;
  if (isEditableTarget(event.target)) return false;
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
  const step = ARROWS[event.key];
  if (step == null) return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  event.preventDefault();
  const size = event.shiftKey ? 10 : 1;
  actions.nudge(step[0] * size, step[1] * size);
  return true;
}
