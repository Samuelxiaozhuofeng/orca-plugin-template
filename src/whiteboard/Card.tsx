import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { ArrangeMenuItems } from "./ArrangeMenu";
import {
  applyCardBox,
  cardHasLiveGesture,
  isOnCardScrollbar,
  RESIZE_HANDLES,
  startResizeCard,
  type ResizeHandle,
} from "./cardGestures";
import { CardTitle } from "./CardTitle";
import {
  CardToolbar,
  openCardInSidePanel,
  openCardInThisPanel,
} from "./CardToolbar";
import { MIN_CARD_HEIGHT, type WhiteboardCard } from "./data";
import type { Side } from "./edges";
import type { ArrangeAction } from "./selection";
import { isHostOverlayTarget } from "./hostOverlay";
import { useCardBlockView } from "./blockWatch";
import { CardBlockTree } from "./CardBlockTree";

const ANCHOR_SIDES: Side[] = ["t", "r", "b", "l"];

const { useEffect, useLayoutEffect, useRef } = window.React;
const { useSnapshot } = window.Valtio;

type Props = {
  panelId: string;
  card: WhiteboardCard;
  degraded: boolean;
  treeRev?: number;
  editing: boolean;
  selected: boolean;
  showResize: boolean;
  selectedCount: number;
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  onStartEdit: (blockId: DbId) => void;
  onEndEdit: () => void;
  onCardMouseDown: (
    event: React.MouseEvent<HTMLDivElement>,
    card: WhiteboardCard,
  ) => void;
  onPatchCard: (
    blockId: DbId,
    patch: { x?: number; y?: number; w?: number; h?: number; color?: string },
  ) => void;
  onArrange: (action: ArrangeAction) => void;
  onSelectOnly: (blockId: DbId) => void;
  onAnchorMouseDown: (
    card: WhiteboardCard,
    side: Side,
    event: React.MouseEvent<HTMLDivElement>,
  ) => void;
  onMoveFrame?: (boxes: Map<DbId, { x: number; y: number; w: number; h: number }>) => void;
};

type CardBox = { x: number; y: number; w: number; h: number };

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

function CardEditor({
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

export function Card({
  panelId,
  card,
  degraded,
  treeRev = 0,
  editing,
  selected,
  showResize,
  selectedCount,
  pointerToWorld,
  onStartEdit,
  onEndEdit,
  onCardMouseDown,
  onPatchCard,
  onArrange,
  onSelectOnly,
  onAnchorMouseDown,
  onMoveFrame,
}: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef(document.body);
  const liveRef = useRef<CardBox>({
    x: card.x,
    y: card.y,
    w: card.w,
    h: card.h,
  });

  if (!cardHasLiveGesture(cardRef.current)) {
    liveRef.current = { x: card.x, y: card.y, w: card.w, h: card.h };
  }

  const hosted = useCardBlockView(card.blockId, treeRev);
  const isEmptyJournal =
    card.kind === "journal" &&
    hosted.exists &&
    !(typeof hosted.text === "string" && hosted.text.trim().length > 0) &&
    hosted.childCount === 0;
  const excerpt = hosted.excerpt;

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (el == null || cardHasLiveGesture(el)) return;
    applyCardBox(el, liveRef.current);
  });

  useEffect(() => {
    if (!editing) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && cardRef.current?.contains(target)) return;
      if (isHostOverlayTarget(target)) return;
      onEndEdit();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEndEdit();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [editing, onEndEdit]);

  const onRootMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".owb-card-handle") && event.button === 0) return;
    if (target?.closest(".owb-card-anchor")) return;
    if (target?.closest(".owb-card-floating-toolbar")) return;
    if (editing && target?.closest(".owb-card-body")) return;
    if (isOnCardScrollbar(event.target, event.clientX, event.clientY)) return;
    onCardMouseDown(event, card);
  };

  const onResizeMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    handle: ResizeHandle,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const el = cardRef.current;
    if (el == null) return;
    const origin = { ...liveRef.current };
    startResizeCard({
      handle,
      startX: event.clientX,
      startY: event.clientY,
      origin,
      el,
      blockId: card.blockId,
      pointerToWorld,
      onFrame: onMoveFrame,
      onEnd: (box) => {
        liveRef.current = box;
        applyCardBox(el, box);
        if (
          box.x === card.x &&
          box.y === card.y &&
          box.w === card.w &&
          box.h === card.h
        ) {
          return;
        }
        onPatchCard(card.blockId, box);
      },
    });
  };

  const fitContentHeight = () => {
    const el = cardRef.current;
    if (!el) return;
    const title = el.querySelector(".owb-card-title, .owb-card-header") as HTMLElement | null;
    const inner = el.querySelector(
      ".orca-block, .orca-block-editor-blocks, .owb-card-excerpt",
    ) as HTMLElement | null;
    const body = el.querySelector(".owb-card-body") as HTMLElement | null;
    const contentH =
      inner?.scrollHeight ?? body?.scrollHeight ?? MIN_CARD_HEIGHT;
    const nextH = Math.max(
      MIN_CARD_HEIGHT,
      (title?.offsetHeight ?? 0) + contentH + 16,
    );
    if (nextH === card.h) return;
    onPatchCard(card.blockId, { w: card.w, h: nextH });
  };

  const className = [
    "owb-card",
    editing ? "is-editing" : "",
    selected ? "is-selected" : "",
    card.color ? `owb-card-theme-${card.color}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const box = liveRef.current;

  return (
    <orca.components.ContextMenu
      container={bodyRef}
      allowBeyondContainer
      menu={(close) => (
        <orca.components.Menu>
          <orca.components.MenuText
            title={t("Open in side panel")}
            onClick={() => {
              close();
              openCardInSidePanel(card.blockId);
            }}
          />
          <orca.components.MenuText
            title={t("Open in this panel")}
            onClick={() => {
              close();
              openCardInThisPanel(card.blockId, panelId);
            }}
          />
          <orca.components.MenuSeparator />
          <orca.components.MenuText
            title={t("Fit content height")}
            onClick={() => {
              close();
              fitContentHeight();
            }}
          />
          <ArrangeMenuItems
            close={close}
            selectedCount={selected ? selectedCount : 1}
            onArrange={onArrange}
          />
        </orca.components.Menu>
      )}
    >
      {(open) => (
        <div
          ref={cardRef}
          className={className}
          data-block-id={card.blockId}
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
          onMouseDown={onRootMouseDown}
          onContextMenu={(event) => {
            // Editing: do not intercept. The hosted Orca editor owns
            // contextmenu (and Canvas already skips .owb-card).
            if (editing) return;
            if (!selected) onSelectOnly(card.blockId);
            open(event);
          }}
        >
          <CardToolbar
            card={card}
            fitContentHeight={fitContentHeight}
            onPatchCard={onPatchCard}
          />
          <CardTitle card={card} editing={editing} />
          <div
            className="owb-card-body"
            title={editing ? undefined : t("Double-click to edit")}
            onDoubleClick={() => {
              if (!editing) onStartEdit(card.blockId);
            }}
          >
            {editing ? (
              <CardEditor panelId={panelId} blockId={card.blockId} />
            ) : isEmptyJournal ? (
              <div className="owb-card-empty">{t("No notes this day")}</div>
            ) : degraded ? (
              <div className="owb-card-excerpt">{excerpt}</div>
            ) : (
              <CardBlockTree
                key={treeRev}
                panelId={panelId}
                blockId={card.blockId}
              />
            )}
          </div>
          {showResize
            ? RESIZE_HANDLES.map((handle) => (
                <div
                  key={handle}
                  className={`owb-card-handle owb-card-handle-${handle}`}
                  onMouseDown={(event) => onResizeMouseDown(event, handle)}
                />
              ))
            : null}
          <div className="owb-card-anchors">
            {ANCHOR_SIDES.map((side) => (
              <div
                key={side}
                className={`owb-card-anchor owb-card-anchor-${side}`}
                data-side={side}
                onMouseDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.stopPropagation();
                  onAnchorMouseDown(card, side, event);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </orca.components.ContextMenu>
  );
}
