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
import { useCardClickCaret } from "./cardClickEdit";
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
import { CardLoadNotice } from "./CardLoadNotice";
import { peekCardLoadNotice } from "./cardTreeLoad";
import {
  blockIdFromCardEventTarget,
  isExtractPointerTarget,
} from "./cardExtractDrag";
import {
  FIT_HEIGHT_EPS,
  measureCardFitHeight,
  shouldLockCardHeight,
} from "./cardFitHeight";
import { CardEditor } from "./CardEditor";
import { useCardAutoHeight } from "./useCardAutoHeight";

const { useEffect, useLayoutEffect, useRef } = window.React;

type Props = {
  panelId: string;
  card: WhiteboardCard;
  treeRev?: number;
  loadRetrying?: boolean;
  onRetryLoad?: (blockId: DbId) => void;
  editing: boolean;
  simplified?: boolean;
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
    patch: {
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      color?: string;
      hLock?: true;
    },
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
  onWrapSelected?: () => void;
};

type CardBox = { x: number; y: number; w: number; h: number };

export function Card({
  panelId,
  card,
  treeRev = 0,
  loadRetrying = false,
  onRetryLoad,
  editing,
  simplified = false,
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
  onWrapSelected,
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

  const heightLockRef = useRef(card.hLock === true);
  const pendingHeightLockRef = useRef(false);
  if (card.hLock === true) {
    heightLockRef.current = true;
    pendingHeightLockRef.current = false;
  } else if (!pendingHeightLockRef.current) {
    heightLockRef.current = false;
  }
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
    if (target?.closest(".owb-card-load-error")) return;
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
        if (shouldLockCardHeight(handle, card.h, box.h)) {
          pendingHeightLockRef.current = true;
          heightLockRef.current = true;
          onPatchCard(card.blockId, { ...box, hLock: true });
        } else {
          onPatchCard(card.blockId, box);
        }
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
    locked: card.hLock === true,
    lockedRef: heightLockRef,
    cardRef,
    blockId: card.blockId,
    heightRef,
    onHeight: applyContentHeight,
  });

  useCardClickCaret(editing, card.blockId, cardRef);

  const fitContentHeight = () => {
    const el = cardRef.current;
    if (el == null) return;
    applyContentHeight(measureCardFitHeight(el), true);
    if (card.hLock === true || heightLockRef.current) {
      pendingHeightLockRef.current = false;
      heightLockRef.current = false;
      onPatchCard(card.blockId, { hLock: undefined });
    }
  };

  const loadNotice = peekCardLoadNotice(card.blockId, promotedKey);
  const shownNotice =
    loadRetrying
      ? {
          scope: loadNotice?.scope ?? (hosted.exists ? "partial" as const : "empty" as const),
          cause: "retryable" as const,
        }
      : loadNotice;
  const fillLoadError = !editing && shownNotice?.scope === "empty";

  const className = [
    "owb-card",
    editing ? "is-editing" : "",
    selected ? "is-selected" : "",
    simplified ? "is-simplified" : "",
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
          {selected && selectedCount >= 2 && onWrapSelected != null ? (
            <orca.components.MenuText
              title={t("Group into section")}
              onClick={() => {
                close();
                onWrapSelected();
              }}
            />
          ) : null}
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
          onDoubleClick={(event: React.MouseEvent<HTMLDivElement>) => {
            if (!simplified || editing) return;
            const target = event.target as HTMLElement | null;
            if (target?.closest(".owb-card-handle, .owb-card-floating-toolbar")) {
              return;
            }
            onStartEdit(card.blockId);
          }}
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
          {simplified ? null : (
            <div
              className="owb-card-body"
              title={editing ? undefined : t("Click to edit")}
              onDoubleClick={() => {
                if (!editing) onStartEdit(card.blockId);
              }}
            >
              {editing ? (
                <CardEditor panelId={panelId} blockId={card.blockId} />
              ) : fillLoadError && shownNotice != null ? (
                <CardLoadNotice
                  scope={shownNotice.scope}
                  cause={shownNotice.cause}
                  fill
                  retrying={loadRetrying}
                  onRetry={() => onRetryLoad?.(card.blockId)}
                />
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
              {shownNotice != null && !fillLoadError ? (
                <CardLoadNotice
                  scope={shownNotice.scope}
                  cause={shownNotice.cause}
                  retrying={loadRetrying}
                  onRetry={() => onRetryLoad?.(card.blockId)}
                />
              ) : null}
            </div>
          )}
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
