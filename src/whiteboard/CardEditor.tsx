import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { CardErrorBoundary } from "./CardErrorBoundary";
import { markCardEditorInput, parkCardEditorHost } from "./cardEditorFlush";
import {
  EDITABLE_SELECTOR,
  readPendingCardEditCaret,
} from "./cardClickEdit";

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

/** Hosts Orca's live BlockPanel inside a card and tracks typing for flush-on-exit. */
export function CardEditor({
  panelId,
  blockId,
}: {
  panelId: string;
  blockId: DbId;
}) {
  const { panelRenderers } = useSnapshot(orca.state);
  const BlockPanel = panelRenderers.block;
  const slotRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (BlockPanel == null) return;
    const slot = slotRef.current;
    if (slot == null) return;

    // Own React root: closing the whiteboard must not unmount BlockPanel
    // before Orca's 240ms content commit can run.
    const host = document.createElement("div");
    host.className = "owb-card-editor";
    slot.appendChild(host);
    const root = window.createRoot(host) as {
      render: (node: React.ReactNode) => void;
      unmount: () => void;
    };
    root.render(
      <CardErrorBoundary>
        <BlockPanel panelId={panelId} blockId={blockId} active />
      </CardErrorBoundary>,
    );

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
    };
    host.addEventListener("beforeinput", mark, true);
    host.addEventListener("input", mark, true);
    host.addEventListener("compositionend", mark, true);
    host.addEventListener("keydown", mark, true);

    let cancelled = false;
    let timer = 0;
    let attempts = 0;
    const focusEditor = () => {
      if (cancelled) return;
      attempts += 1;
      // Aim the focus click at wherever the user clicked. Falling back to the
      // first line is what used to park the caret at the very start of the
      // card no matter where the click landed.
      const aimed = editableAtClick(host, blockId);
      const target = aimed?.el ?? firstEditableLine(host);
      if (target == null) {
        if (attempts < 20) timer = window.setTimeout(focusEditor, 25);
        return;
      }
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
    };
    timer = window.setTimeout(focusEditor, 10);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
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

  if (BlockPanel == null) {
    return <div className="owb-card-editor-missing">{t("Editor unavailable")}</div>;
  }
  // Slot only: BlockPanel lives on an independent root so closing the
  // whiteboard can park it until the host editor finishes committing.
  return <div ref={slotRef} className="owb-card-editor" />;
}
