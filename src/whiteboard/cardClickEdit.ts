import type { DbId } from "../orca.d.ts";
import { cardBlockIdFromInlineRefTarget } from "./cardFocus";
import { isExtractPointerTarget } from "./cardExtractDrag";
import { isOnCardScrollbar } from "./cardGestures";
import { CARD_ROW_FOCUS_CLASS } from "./cardRowOnBoard";
import { CARD_BACK_CLASS } from "./cardParentOnBoard";
import { FOLDING_HANDLE_SELECTOR } from "./cardTreePlan";
import { CLICK_THRESHOLD_PX } from "./marquee";

const { useEffect } = window.React;

/** After the hosted editor is ready, retry a few frames if the hit misses. */
export const CARET_RETRY_FRAMES = 4;

/**
 * Orca's block editor is a single `contenteditable="plaintext-only"` host —
 * NOT `contenteditable="true"`, and its inner rows carry `contenteditable=
 * "false"`. Matching on `"true"` finds nothing inside a card, which is what
 * used to leave the caret wherever Orca put it (the start of the block).
 */
export const EDITABLE_ONLY_SELECTOR =
  '[contenteditable]:not([contenteditable="false"])';
export const EDITABLE_SELECTOR = `${EDITABLE_ONLY_SELECTOR}, input, textarea`;

const CLICK_EDIT_BLOCK =
  `.owb-card-header, .owb-card-journal-badge, .owb-card-handle, .owb-card-floating-toolbar, .owb-card-load-error, .${CARD_ROW_FOCUS_CLASS}, .${CARD_BACK_CLASS}, ${FOLDING_HANDLE_SELECTOR}`;

export type CardClickEditInput = {
  button: number;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  clientX: number;
  clientY: number;
  target: EventTarget | null;
  simplified?: boolean;
  editing?: boolean;
};

/** True when a left press on the card body should enter edit on release. */
export function isCardBodyClickEdit(input: CardClickEditInput): boolean {
  if (input.button !== 0) return false;
  if (input.shiftKey || input.altKey || input.metaKey || input.ctrlKey) {
    return false;
  }
  if (input.simplified === true || input.editing === true) return false;
  if (!(input.target instanceof Element)) return false;
  if (input.target.closest(CLICK_EDIT_BLOCK) != null) return false;
  if (input.target.closest(".owb-card-body") == null) return false;
  if (isExtractPointerTarget(input.target)) return false;
  if (cardBlockIdFromInlineRefTarget(input.target) != null) return false;
  return !isOnCardScrollbar(input.target, input.clientX, input.clientY);
}

type PendingCaret = { blockId: DbId; x: number; y: number; at: number };

/** A click point older than this belongs to a previous edit, not this one. */
const CARET_TTL_MS = 3_000;

let pendingCaret: PendingCaret | null = null;

export function requestCardEditCaret(
  blockId: DbId,
  clientX: number,
  clientY: number,
): void {
  pendingCaret = { blockId, x: clientX, y: clientY, at: Date.now() };
}

/**
 * The click that opened this card's editor, if it is still fresh.
 *
 * Deliberately non-consuming: both the editor's initial focus click and the
 * follow-up caret loop need the same point. Whoever reads it first must not
 * leave the other one aiming at the first line instead.
 */
export function readPendingCardEditCaret(
  blockId: DbId,
): { x: number; y: number } | null {
  if (pendingCaret == null || pendingCaret.blockId !== blockId) return null;
  if (Date.now() - pendingCaret.at > CARET_TTL_MS) {
    pendingCaret = null;
    return null;
  }
  return { x: pendingCaret.x, y: pendingCaret.y };
}

/** Drop the stored point once this card is done with it. */
export function clearPendingCardEditCaret(blockId: DbId): void {
  if (pendingCaret != null && pendingCaret.blockId === blockId) {
    pendingCaret = null;
  }
}

type EditorReadyListener = (blockId: DbId) => void;

const readyListeners = new Set<EditorReadyListener>();
let lastEditorReady: { blockId: DbId; at: number } | null = null;

/** Same TTL as the click point: a stale ready belongs to a previous edit. */
const EDITOR_READY_TTL_MS = CARET_TTL_MS;

/** Hosted editor just grew a visible editable line for this card. */
export function notifyCardEditorReady(blockId: DbId): void {
  lastEditorReady = { blockId, at: Date.now() };
  for (const listener of readyListeners) listener(blockId);
}

export function isCardEditorJustReady(blockId: DbId): boolean {
  if (lastEditorReady == null || lastEditorReady.blockId !== blockId) {
    return false;
  }
  if (Date.now() - lastEditorReady.at > EDITOR_READY_TTL_MS) {
    lastEditorReady = null;
    return false;
  }
  return true;
}

export function subscribeCardEditorReady(
  listener: EditorReadyListener,
): () => void {
  readyListeners.add(listener);
  return () => {
    readyListeners.delete(listener);
  };
}

/** Same threshold as card drag: fire `onClick` only if the pointer stayed put. */
export function watchPointerClick(opts: {
  startX: number;
  startY: number;
  onClick: (event: MouseEvent) => void;
}): void {
  let moved = false;
  let finished = false;
  const onMove = (event: MouseEvent) => {
    if (finished || moved) return;
    const dx = event.clientX - opts.startX;
    const dy = event.clientY - opts.startY;
    if (dx * dx + dy * dy < CLICK_THRESHOLD_PX * CLICK_THRESHOLD_PX) return;
    moved = true;
  };
  const onUp = (event: MouseEvent) => {
    if (finished) return;
    finished = true;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    if (!moved) opts.onClick(event);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

function nodeIsEditable(node: Node): boolean {
  const el = node instanceof Element ? node : node.parentElement;
  if (el == null) return false;
  if (el.closest(EDITABLE_ONLY_SELECTOR) != null) return true;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

function rangeFromPoint(clientX: number, clientY: number): Range | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (typeof doc.caretPositionFromPoint === "function") {
    const pos = doc.caretPositionFromPoint(clientX, clientY);
    if (pos == null) return null;
    const range = document.createRange();
    try {
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
      return range;
    } catch {
      return null;
    }
  }
  if (typeof doc.caretRangeFromPoint === "function") {
    try {
      return doc.caretRangeFromPoint(clientX, clientY);
    } catch {
      return null;
    }
  }
  return null;
}

function caretAlreadyAtPoint(
  clientX: number,
  clientY: number,
  root: HTMLElement,
): boolean {
  const sel = window.getSelection();
  if (sel == null || sel.rangeCount !== 1) return false;
  const current = sel.getRangeAt(0);
  if (!current.collapsed) return false;
  if (!root.contains(current.startContainer)) return false;
  if (!nodeIsEditable(current.startContainer)) return false;
  const expected = rangeFromPoint(clientX, clientY);
  if (expected == null) return false;
  return (
    current.startContainer === expected.startContainer &&
    current.startOffset === expected.startOffset
  );
}

function tryPlaceCaretAtPoint(
  clientX: number,
  clientY: number,
  root: HTMLElement | null,
): boolean {
  try {
    if (root == null) return false;
    if (caretAlreadyAtPoint(clientX, clientY, root)) return true;
    const range = rangeFromPoint(clientX, clientY);
    if (range == null) return false;
    if (!root.contains(range.startContainer)) return false;
    if (!nodeIsEditable(range.startContainer)) return false;
    const sel = window.getSelection();
    if (sel == null) return false;
    sel.removeAllRanges();
    sel.addRange(range);
    const host =
      range.startContainer instanceof HTMLElement
        ? range.startContainer
        : range.startContainer.parentElement;
    const editable = host?.closest(
      EDITABLE_SELECTOR,
    );
    if (editable instanceof HTMLElement) {
      editable.focus({ preventScroll: true });
    }
    return true;
  } catch {
    return false;
  }
}

/** Orca's editor cursor comes from a pointer hit; one late click at the
 * original point beats CardEditor's first-line focus click. */
function hitEditorAtPoint(
  clientX: number,
  clientY: number,
  root: HTMLElement | null,
): boolean {
  try {
    if (root == null) return false;
    const hit = document.elementFromPoint(clientX, clientY);
    if (!(hit instanceof Element) || !root.contains(hit)) return false;
    const editable = hit.closest(EDITABLE_SELECTOR);
    if (!(editable instanceof HTMLElement)) return false;
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX,
      clientY,
    };
    editable.dispatchEvent(new MouseEvent("mousedown", opts));
    editable.dispatchEvent(new MouseEvent("mouseup", opts));
    editable.dispatchEvent(new MouseEvent("click", opts));
    return true;
  } catch {
    return false;
  }
}

/** After the hosted editor is ready, put the caret at the original click. */
export function useCardClickCaret(
  editing: boolean,
  blockId: DbId,
  cardRef: { current: HTMLElement | null },
): void {
  useEffect(() => {
    if (!editing) return;
    const pending = readPendingCardEditCaret(blockId);
    if (pending == null) return;
    let frames = 0;
    let raf = 0;
    let started = false;
    const place = () => {
      frames += 1;
      const placed = tryPlaceCaretAtPoint(
        pending.x,
        pending.y,
        cardRef.current,
      );
      if (placed) {
        hitEditorAtPoint(pending.x, pending.y, cardRef.current);
        tryPlaceCaretAtPoint(pending.x, pending.y, cardRef.current);
        return;
      }
      if (frames < CARET_RETRY_FRAMES) {
        raf = window.requestAnimationFrame(place);
      }
    };
    const start = () => {
      if (started) return;
      started = true;
      place();
    };
    if (isCardEditorJustReady(blockId)) start();
    const unsubscribe = subscribeCardEditorReady((readyId) => {
      if (readyId === blockId) start();
    });
    return () => {
      unsubscribe();
      window.cancelAnimationFrame(raf);
      clearPendingCardEditCaret(blockId);
    };
  }, [blockId, cardRef, editing]);
}
