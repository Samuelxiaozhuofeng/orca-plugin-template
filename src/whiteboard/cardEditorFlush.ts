/**
 * Orca's block editor (`useEditorLogic`) does not write on every keystroke.
 * It buffers inserts/deletes and commits with `core.editor.setBlocksContent`
 * after COMMIT_WAIT_TIME (240ms) through `panel.viewState.editor`.
 *
 * Unmounting the hosted BlockPanel runs `unregisterPanelEditor`, which deletes
 * `viewState.editor`. A commit that then fires (or is still in AutoTaskQueue)
 * no-ops, and the card snaps back to the last saved text.
 */

/** Matches Orca's COMMIT_WAIT_TIME. */
export const ORCA_COMMIT_WAIT_MS = 240;
/** Time for AutoTaskQueue + invokeTopCommand after the debounce fires. */
export const ORCA_COMMAND_SLACK_MS = 200;
export const CARD_EDITOR_FLUSH_MS = ORCA_COMMIT_WAIT_MS + ORCA_COMMAND_SLACK_MS;

let lastInputAt = 0;

export function markCardEditorInput(at = Date.now()): void {
  lastInputAt = at;
}

export function cardEditorFlushDelayMs(now = Date.now()): number {
  if (lastInputAt <= 0) return 0;
  return Math.max(0, CARD_EDITOR_FLUSH_MS - (now - lastInputAt));
}

export function blurCardEditor(root: ParentNode | null): void {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return;
  if (root != null && !root.contains(active)) return;
  if (active.closest(".owb-card-editor") == null) return;
  active.blur();
}

export function resetCardEditorFlushForTest(): void {
  lastInputAt = 0;
}
