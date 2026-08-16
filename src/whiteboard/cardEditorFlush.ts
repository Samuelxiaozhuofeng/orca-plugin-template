/**
 * Orca's block editor (`useEditorLogic`) does not write on every keystroke.
 * It buffers inserts/deletes and commits with `core.editor.setBlocksContent`
 * after COMMIT_WAIT_TIME (240ms) through `panel.viewState.editor`.
 *
 * Unmounting the hosted BlockPanel runs `unregisterPanelEditor`, which deletes
 * `viewState.editor`. A commit that then fires (or is still in AutoTaskQueue)
 * no-ops, and the card snaps back to the last saved text.
 *
 * CardEditor therefore hosts BlockPanel on its own React root. Closing the
 * whiteboard parks that root off the dying tree until this window elapses.
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

/** Blur every hosted card editor. `root` limits the search when given. */
export function blurAllCardEditors(root?: ParentNode | null): void {
  const scope =
    root ?? (typeof document === "undefined" ? null : document);
  if (scope == null) return;
  blurCardEditor(scope);
}

type ParkedEditor = {
  release: () => void;
  done: Promise<void>;
};

const parked = new Set<ParkedEditor>();

/** Pure: release now, or after `wait` ms. Used so panel-close can keep the editor. */
export function scheduleCardEditorRelease(
  release: () => void,
  wait: number,
  schedule: (fn: () => void, ms: number) => number = (fn, ms) =>
    window.setTimeout(fn, ms),
): { scheduled: boolean; wait: number } {
  if (wait <= 0) {
    release();
    return { scheduled: false, wait: 0 };
  }
  schedule(release, wait);
  return { scheduled: true, wait };
}

export function hideParkedEditorHost(host: HTMLElement): void {
  host.setAttribute("data-owb-editor-hold", "1");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0px";
  host.style.width = "480px";
  host.style.height = "320px";
  host.style.opacity = "0";
  host.style.pointerEvents = "none";
}

/**
 * Blur, then if the commit window is still open, move `host` off the dying
 * card tree so the hosted BlockPanel stays mounted until Orca can commit.
 */
export function parkCardEditorHost(
  host: HTMLElement,
  release: () => void,
  now = Date.now(),
): void {
  blurCardEditor(host);
  const wait = cardEditorFlushDelayMs(now);
  if (wait <= 0 || typeof document === "undefined") {
    release();
    return;
  }
  if (host.parentNode !== document.body) {
    document.body.appendChild(host);
  }
  hideParkedEditorHost(host);

  let settled = false;
  let resolveDone = (): void => {};
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  const finish = (): void => {
    if (settled) return;
    settled = true;
    parked.delete(entry);
    release();
    resolveDone();
  };
  const entry: ParkedEditor = { release: finish, done };
  parked.add(entry);
  scheduleCardEditorRelease(finish, wait);
}

export function parkedCardEditorCount(): number {
  return parked.size;
}

export async function awaitParkedCardEditors(): Promise<void> {
  if (parked.size === 0) return;
  await Promise.all([...parked].map((item) => item.done));
}

export function releaseParkedCardEditors(): void {
  for (const item of [...parked]) item.release();
}

/**
 * Start Orca's editor commit (blur) and wait out the remaining debounce.
 * `unload()` can await this while the hosted editor is still mounted.
 * Also waits out any editors already parked after a panel close.
 */
export async function flushCardEditorsAndWait(
  now = Date.now(),
): Promise<void> {
  blurAllCardEditors();
  const wait = cardEditorFlushDelayMs(now);
  await Promise.all([
    wait > 0
      ? new Promise<void>((resolve) => {
          window.setTimeout(resolve, wait);
        })
      : Promise.resolve(),
    awaitParkedCardEditors(),
  ]);
}

export function resetCardEditorFlush(): void {
  lastInputAt = 0;
  releaseParkedCardEditors();
}

export function resetCardEditorFlushForTest(): void {
  resetCardEditorFlush();
}
