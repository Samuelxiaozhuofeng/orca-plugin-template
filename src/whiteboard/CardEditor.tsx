import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { CardErrorBoundary } from "./CardErrorBoundary";
import { markCardEditorInput, parkCardEditorHost } from "./cardEditorFlush";
import {
  EDITABLE_SELECTOR,
  notifyCardEditorReady,
  readPendingCardEditCaret,
} from "./cardClickEdit";
import {
  countCoveredLines,
  countEditorLines,
  EDITOR_COVER_QUIET_FRAMES,
  shouldLiftEditorCover,
} from "./editorCover";

/** Last-resort focus if MutationObserver never sees an editable line. */
const FOCUS_FALLBACK_MS = 500;

const { useLayoutEffect, useRef } = window.React;
const { useSnapshot } = window.Valtio;

/** First visible editable line inside the card editor (hidden chrome skipped). */
function firstEditableLine(root: HTMLElement): HTMLElement | null {
  const candidates = root.querySelectorAll<HTMLElement>(
    EDITABLE_SELECTOR,
  );
  for (const node of Array.from(candidates)) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return node;
  }
  return null;
}

/**
 * The editable line under the click that opened this editor, if the click
 * point still lands inside it. Null means "no usable point — use the first
 * line", e.g. the click was on the card's padding or the layout has shifted.
 */
function editableAtClick(
  host: HTMLElement,
  blockId: DbId,
): { el: HTMLElement; x: number; y: number } | null {
  const point = readPendingCardEditCaret(blockId);
  if (point == null) return null;
  try {
    const hit = document.elementFromPoint(point.x, point.y);
    if (!(hit instanceof Element) || !host.contains(hit)) return null;
    const editable = hit.closest<HTMLElement>(
      EDITABLE_SELECTOR,
    );
    if (editable == null || !host.contains(editable)) return null;
    return { el: editable, x: point.x, y: point.y };
  } catch {
    return null;
  }
}

type CoreHandle = {
  host: HTMLElement;
  paint: (isActive: boolean) => void;
  signalCoverReady: () => void;
  coveredLines: number;
  cancelled: boolean;
};

/** Hosts Orca's live BlockPanel inside a card and tracks typing for flush-on-exit. */
export function CardEditor({
  panelId,
  blockId,
  active = true,
  onReady,
}: {
  panelId: string;
  blockId: DbId;
  active?: boolean;
  onReady?: () => void;
}) {
  // Subscribe only to the renderer registry. useSnapshot(orca.state)
  // listens to the whole store; a blocks write then snapshots every
  // note before isChanged can ignore it. During editor mount that
  // happens once per batch of rows.
  const panelRenderers = useSnapshot(orca.state.panelRenderers);
  const BlockPanel = panelRenderers.block;
  const slotRef = useRef<HTMLDivElement | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const coreRef = useRef<CoreHandle | null>(null);

  // Effect A: create host, create root, cover observation, input listeners.
  // Never unmounts on active toggle.
  useLayoutEffect(() => {
    if (BlockPanel == null) return;
    const slot = slotRef.current;
    if (slot == null) return;

    // Own React root: closing the whiteboard must not unmount BlockPanel
    // before Orca's 240ms content commit can run.
    const host = document.createElement("div");
    host.className = "owb-card-editor";
    slot.appendChild(host);

    const coveredLines = countCoveredLines(host);

    let cancelled = false;
    let coverSignalled = false;
    let coverRaf = 0;
    let coverDirty = false;
    let sawChange = false;
    let quietFrames = 0;
    let coverObserver: MutationObserver | null = null;

    const stopCoverWatching = () => {
      if (coverRaf !== 0) {
        window.cancelAnimationFrame(coverRaf);
        coverRaf = 0;
      }
      coverObserver?.disconnect();
      coverObserver = null;
    };

    const signalCoverReady = () => {
      if (coverSignalled || cancelled) return;
      coverSignalled = true;
      stopCoverWatching();
      onReadyRef.current?.();
    };

    const tickCover = () => {
      coverRaf = 0;
      if (cancelled || coverSignalled) return;

      if (coverDirty) {
        coverDirty = false;
        sawChange = true;
        quietFrames = 0;
      } else if (sawChange) {
        quietFrames++;
      }

      const editorLines = countEditorLines(host);
      if (
        shouldLiftEditorCover({
          editorLines,
          coveredLines,
          quietFrames,
          sawChange,
        })
      ) {
        signalCoverReady();
        return;
      }

      if (sawChange && quietFrames < EDITOR_COVER_QUIET_FRAMES) {
        coverRaf = window.requestAnimationFrame(tickCover);
      }
    };

    coverObserver = new MutationObserver(() => {
      coverDirty = true;
      if (coverRaf === 0) {
        coverRaf = window.requestAnimationFrame(tickCover);
      }
    });
    coverObserver.observe(host, { childList: true, subtree: true });

    const root = window.createRoot(host) as {
      render: (node: React.ReactNode) => void;
      unmount: () => void;
    };

    const paint = (isActive: boolean) => {
      if (cancelled) return;
      host.className = isActive ? "owb-card-editor" : "owb-card-editor is-prewarm";
      if (slotRef.current) {
        slotRef.current.className = isActive
          ? "owb-card-editor"
          : "owb-card-editor is-prewarm";
      }
      if (isActive) {
        host.removeAttribute("inert");
        host.removeAttribute("aria-hidden");
      } else {
        host.setAttribute("inert", "");
        host.setAttribute("aria-hidden", "true");
      }
      root.render(
        <CardErrorBoundary>
          <BlockPanel panelId={panelId} blockId={blockId} active={isActive} />
        </CardErrorBoundary>,
      );
    };

    const mark = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        if (
          event.key === "Escape" ||
          event.key === "Shift" ||
          event.key === "Meta" ||
          event.key === "Control" ||
          event.key === "Alt"
        ) {
          return;
        }
      }
      markCardEditorInput();
      // Any real input means the user is already typing. The cover would
      // then show stale rows over a live editor, so drop it right away
      // rather than waiting out the settle window.
      signalCoverReady();
    };
    host.addEventListener("beforeinput", mark, true);
    host.addEventListener("input", mark, true);
    host.addEventListener("compositionend", mark, true);
    host.addEventListener("keydown", mark, true);

    const handle: CoreHandle = {
      host,
      paint,
      signalCoverReady,
      coveredLines,
      get cancelled() {
        return cancelled;
      },
    };
    coreRef.current = handle;

    return () => {
      cancelled = true;
      coreRef.current = null;
      stopCoverWatching();
      host.removeEventListener("beforeinput", mark, true);
      host.removeEventListener("input", mark, true);
      host.removeEventListener("compositionend", mark, true);
      host.removeEventListener("keydown", mark, true);
      parkCardEditorHost(host, () => {
        root.unmount();
        host.remove();
      });
    };
  }, [BlockPanel, blockId, panelId]);

  // Effect B: updates active state, handles focus when active is true.
  useLayoutEffect(() => {
    const core = coreRef.current;
    if (core == null) return;
    const { host, paint, signalCoverReady, coveredLines } = core;

    paint(active);

    if (!active) return;

    // From prewarm to active: if cover condition already satisfied, lift immediately.
    if (
      shouldLiftEditorCover({
        editorLines: countEditorLines(host),
        coveredLines,
        quietFrames: EDITOR_COVER_QUIET_FRAMES,
        sawChange: true,
      })
    ) {
      signalCoverReady();
    }

    let focusSignalled = false;
    let fallbackTimer = 0;
    let focusObserver: MutationObserver | null = null;

    const stopWatchingFocus = () => {
      if (focusObserver != null) {
        focusObserver.disconnect();
        focusObserver = null;
      }
      if (fallbackTimer !== 0) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = 0;
      }
    };

    const signalFocusReady = () => {
      if (focusSignalled || core.cancelled) return;
      focusSignalled = true;
      notifyCardEditorReady(blockId);
    };

    const focusEditor = (): boolean => {
      if (core.cancelled) return false;
      // Aim the focus click at wherever the user clicked. Falling back to the
      // first line is what used to park the caret at the very start of the
      // card no matter where the click landed.
      const aimed = editableAtClick(host, blockId);
      const target = aimed?.el ?? firstEditableLine(host);
      if (target == null) return false;
      target.focus({ preventScroll: true });
      const rect = target.getBoundingClientRect();
      const clientX = aimed?.x ?? rect.left + 2;
      const clientY = aimed?.y ?? rect.top + Math.min(10, rect.height / 2);
      try {
        const opts = {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX,
          clientY,
        };
        target.dispatchEvent(new MouseEvent("mousedown", opts));
        target.dispatchEvent(new MouseEvent("mouseup", opts));
        target.dispatchEvent(new MouseEvent("click", opts));
      } catch (err) {
        console.error(
          "Whiteboard card editor: failed to deliver focus click",
          err,
        );
      }
      // Signal last: the caret hook places at the click point on this
      // signal, and must run after our own focus click, not before it.
      signalFocusReady();
      return true;
    };

    if (!focusEditor()) {
      focusObserver = new MutationObserver(() => {
        if (focusEditor()) stopWatchingFocus();
      });
      focusObserver.observe(host, { childList: true, subtree: true });
      fallbackTimer = window.setTimeout(() => {
        stopWatchingFocus();
        focusEditor();
      }, FOCUS_FALLBACK_MS);
    }

    return () => {
      stopWatchingFocus();
    };
  }, [active, BlockPanel, blockId, panelId]);

  if (BlockPanel == null) {
    return <div className="owb-card-editor-missing">{t("Editor unavailable")}</div>;
  }
  // Slot only: BlockPanel lives on an independent root so closing the
  // whiteboard can park it until the host editor finishes committing.
  return (
    <div
      ref={slotRef}
      className={active ? "owb-card-editor" : "owb-card-editor is-prewarm"}
    />
  );
}
