import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { markCardEditorInput } from "./cardEditorFlush";

const { useEffect, useRef } = window.React;
const { useSnapshot } = window.Valtio;

/** First visible editable line inside the card editor (hidden chrome skipped). */
function firstEditableLine(root: HTMLElement): HTMLElement | null {
  const candidates = root.querySelectorAll<HTMLElement>(
    '[contenteditable="true"], input, textarea',
  );
  for (const node of Array.from(candidates)) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return node;
  }
  return null;
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
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let attempts = 0;

    const focusEditor = () => {
      if (cancelled) return;
      attempts++;
      const el = editorRef.current;
      if (el == null) return;

      const target = firstEditableLine(el);
      if (target == null) {
        if (attempts < 20) timer = window.setTimeout(focusEditor, 25);
        return;
      }

      target.focus({ preventScroll: true });
      // Host CursorData is derived from a pointer hit. Deliver one hit so
      // the editor activates; do not then overwrite the caret it places.
      const rect = target.getBoundingClientRect();
      const clientX = rect.left + 2;
      const clientY = rect.top + Math.min(10, rect.height / 2);
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
    };
  }, [blockId, panelId]);

  useEffect(() => {
    const el = editorRef.current;
    if (el == null) return;
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
    el.addEventListener("beforeinput", mark, true);
    el.addEventListener("input", mark, true);
    el.addEventListener("compositionend", mark, true);
    el.addEventListener("keydown", mark, true);
    return () => {
      el.removeEventListener("beforeinput", mark, true);
      el.removeEventListener("input", mark, true);
      el.removeEventListener("compositionend", mark, true);
      el.removeEventListener("keydown", mark, true);
    };
  }, [blockId, panelId]);

  if (BlockPanel == null) {
    return <div className="owb-card-editor-missing">{t("Editor unavailable")}</div>;
  }
  // No extra .orca-panel[data-panel-id] wrapper: the real panel already
  // owns that id. A second node with the same id would steal closest().
  return (
    <div ref={editorRef} className="owb-card-editor">
      <BlockPanel panelId={panelId} blockId={blockId} active />
    </div>
  );
}
