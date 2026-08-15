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
import { type WhiteboardCard } from "./data";
import type { ArrangeAction } from "./selection";
import { isHostOverlayTarget } from "./hostOverlay";
import { useCardBlockView } from "./blockWatch";
import { CardBlockTree } from "./CardBlockTree";
import {
  blockIdFromCardEventTarget,
  isExtractPointerTarget,
} from "./cardExtractDrag";
import { FIT_HEIGHT_EPS, measureCardFitHeight } from "./cardFitHeight";
import { useCardAutoHeight } from "./useCardAutoHeight";

const { useEffect, useLayoutEffect, useRef } = window.React;
const { useSnapshot } = window.Valtio;

type Props = {
  panelId: string;
  card: WhiteboardCard;
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
  onContentHeight: (blockId: DbId, nextH: number, record: boolean) => void;
  onArrange: (action: ArrangeAction) => void;
  onSelectOnly: (blockId: DbId) => void;
  onStartConnect: (
    card: WhiteboardCard,
    event: React.MouseEvent,
    mode: "drag" | "click",
  ) => void;
  onMoveFrame?: (boxes: Map<DbId, { x: number; y: number; w: number; h: number }>) => void;
  promotedKey?: string;
  onExtractRow?: (blockId: DbId, sourceCard: WhiteboardCard) => void;
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
  onContentHeight,
  onArrange,
  onSelectOnly,
  onStartConnect,
  onMoveFrame,
  promotedKey = "",
  onExtractRow,
}: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const extractRowRef = useRef<DbId | null>(null);
  const bodyRef = useRef(document.body);
  const liveRef = useRef<CardBox>({
    x: card.x,
    y: card.y,
    w: card.w,
    h: card.h,
  });

  const pendingHRef = useRef<number | null>(null);
  if (!cardHasLiveGesture(cardRef.current)) {
    const h = pendingHRef.current ?? card.h;
    liveRef.current = { x: card.x, y: card.y, w: card.w, h };
    if (pendingHRef.current != null && card.h === pendingHRef.current) {
      pendingHRef.current = null;
    }
  }

  const hosted = useCardBlockView(card.blockId, treeRev);
  const isEmptyJournal =
    card.kind === "journal" &&
    hosted.exists &&
    !(typeof hosted.text === "string" && hosted.text.trim().length > 0) &&
    hosted.childCount === 0;

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
    if (isExtractPointerTarget(target)) return;
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
        pendingHRef.current = null;
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

  const heightRef = useRef(card.h);
  heightRef.current = liveRef.current.h;

  const applyContentHeight = (nextH: number, record: boolean) => {
    const el = cardRef.current;
    if (el == null || cardHasLiveGesture(el)) return;
    if (Math.abs(nextH - liveRef.current.h) < FIT_HEIGHT_EPS) return;
    pendingHRef.current = nextH;
    liveRef.current = { ...liveRef.current, h: nextH };
    heightRef.current = nextH;
    applyCardBox(el, liveRef.current);
    onContentHeight(card.blockId, nextH, record);
  };

  useCardAutoHeight({
    enabled: editing,
    cardRef,
    blockId: card.blockId,
    heightRef,
    onHeight: applyContentHeight,
  });

  const fitContentHeight = () => {
    const el = cardRef.current;
    if (el == null) return;
    applyContentHeight(measureCardFitHeight(el), true);
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
          {(() => {
            const rowId = extractRowRef.current;
            if (
              onExtractRow == null ||
              rowId == null ||
              rowId === card.blockId
            ) {
              return null;
            }
            return (
              <orca.components.MenuText
                title={t("Extract as card")}
                onClick={() => {
                  close();
                  onExtractRow(rowId, card);
                }}
              />
            );
          })()}
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
            const rowId = blockIdFromCardEventTarget(event.target);
            extractRowRef.current =
              rowId != null && rowId !== card.blockId ? rowId : null;
            open(event);
          }}
        >
          <CardToolbar
            card={card}
            fitContentHeight={fitContentHeight}
            onPatchCard={onPatchCard}
            onStartConnect={onStartConnect}
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
            ) : (
              <CardBlockTree
                key={treeRev}
                panelId={panelId}
                blockId={card.blockId}
                promotedKey={promotedKey}
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
        </div>
      )}
    </orca.components.ContextMenu>
  );
}
