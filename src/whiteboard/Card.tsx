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
import { MIN_CARD_HEIGHT, type WhiteboardCard } from "./data";
import type { Side } from "./edges";
import type { ArrangeAction } from "./selection";
import { cachedBlockPlainText, cardExcerpt } from "./viewTransform";

const ANCHOR_SIDES: Side[] = ["t", "r", "b", "l"];

const { useEffect, useLayoutEffect, useRef } = window.React;
const { useSnapshot } = window.Valtio;

type Props = {
  panelId: string;
  card: WhiteboardCard;
  degraded: boolean;
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

function CardEditor({ blockId }: { blockId: DbId }) {
  const { panelRenderers } = useSnapshot(orca.state);
  const BlockPanel = panelRenderers.block;
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let attempts = 0;
    const focusEditor = () => {
      attempts++;
      const el = editorRef.current;
      if (!el) return;

      const focusable = (
        el.querySelector('[contenteditable="true"]') ||
        el.querySelector('.orca-block-text') ||
        el.querySelector('.orca-block-content') ||
        el.querySelector('input, textarea')
      ) as HTMLElement | null;

      if (focusable) {
        focusable.focus({ preventScroll: true });
        
        // Dispatch mouse events to trigger active text editing mode instantly
        try {
          const opts = { bubbles: true, cancelable: true, view: window };
          focusable.dispatchEvent(new MouseEvent("mousedown", opts));
          focusable.dispatchEvent(new MouseEvent("mouseup", opts));
          focusable.dispatchEvent(new MouseEvent("click", opts));
        } catch {
          // ignore event dispatch errors if any
        }

        if (focusable.getAttribute("contenteditable") === "true") {
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            range.selectNodeContents(focusable);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      } else if (attempts < 12) {
        setTimeout(focusEditor, 25);
      }
    };

    setTimeout(focusEditor, 10);
  }, [blockId]);

  if (BlockPanel == null) {
    return <div className="owb-card-editor-missing">{t("Editor unavailable")}</div>;
  }
  return (
    <div ref={editorRef} className="owb-card-editor">
      <div className="orca-panel" data-panel-id="_reference">
        <div className="orca-hideable">
          <BlockPanel
            panelId="_reference"
            blockId={blockId}
            preview="content"
            active
          />
        </div>
      </div>
    </div>
  );
}

const COLOR_PRESETS = [
  { id: "default", label: "Default", bg: "var(--orca-color-bg-1)" },
  { id: "blue", label: "Blue", bg: "rgba(47, 128, 237, 0.18)" },
  { id: "green", label: "Green", bg: "rgba(34, 197, 94, 0.18)" },
  { id: "yellow", label: "Yellow", bg: "rgba(234, 179, 8, 0.22)" },
  { id: "coral", label: "Coral", bg: "rgba(244, 63, 94, 0.18)" },
  { id: "purple", label: "Purple", bg: "rgba(168, 85, 247, 0.18)" },
];

function CardToolbar({
  panelId,
  card,
  fitContentHeight,
  onPatchCard,
}: {
  panelId: string;
  card: WhiteboardCard;
  fitContentHeight: () => void;
  onPatchCard: Props["onPatchCard"];
}) {
  const [colorMenuOpen, setColorMenuOpen] = window.React.useState(false);

  const openSplitView = () => {
    try {
      orca.nav.addTo(panelId, "right", {
        view: "block",
        viewArgs: { blockId: card.blockId },
        viewState: {},
      });
    } catch (err) {
      console.error("Failed to open split view", err);
    }
  };

  return (
    <div
      className="owb-card-floating-toolbar"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="owb-card-tb-btn"
        title={t("Open side-by-side")}
        onClick={openSplitView}
      >
        <i className="ti ti-layout-sidebar-right" />
      </button>
      <button
        type="button"
        className="owb-card-tb-btn"
        title={t("Fit content height")}
        onClick={fitContentHeight}
      >
        <i className="ti ti-arrows-vertical" />
      </button>
      <div className="owb-card-tb-popover-wrapper">
        <button
          type="button"
          className="owb-card-tb-btn"
          title={t("Card color")}
          onClick={() => setColorMenuOpen((v: boolean) => !v)}
        >
          <i className="ti ti-palette" />
        </button>
        {colorMenuOpen ? (
          <div className="owb-card-color-popover">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`owb-card-color-dot${
                  (card.color || "default") === preset.id ? " is-active" : ""
                }`}
                style={{ backgroundColor: preset.bg }}
                title={preset.label}
                onClick={() => {
                  setColorMenuOpen(false);
                  onPatchCard(card.blockId, {
                    color: preset.id === "default" ? undefined : preset.id,
                  });
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Card({
  panelId,
  card,
  degraded,
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
  const liveRef = useRef<CardBox>({
    x: card.x,
    y: card.y,
    w: card.w,
    h: card.h,
  });

  if (!cardHasLiveGesture(cardRef.current)) {
    liveRef.current = { x: card.x, y: card.y, w: card.w, h: card.h };
  }

  const { blocks } = useSnapshot(orca.state);
  const hosted = blocks[card.blockId];
  const isEmptyJournal =
    card.kind === "journal" &&
    hosted != null &&
    !(typeof hosted.text === "string" && hosted.text.trim().length > 0) &&
    (hosted.children?.length ?? 0) === 0;
  const excerpt = cardExcerpt(cachedBlockPlainText(card.blockId, blocks));

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
      menu={(close) => (
        <orca.components.Menu>
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
            if (editing) {
              event.preventDefault();
              return;
            }
            if (!selected) onSelectOnly(card.blockId);
            open(event);
          }}
        >
          {selected ? <div className="owb-card-accent-diamond" /> : null}
          <CardToolbar
            panelId={panelId}
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
              <CardEditor blockId={card.blockId} />
            ) : isEmptyJournal ? (
              <div className="owb-card-empty">{t("No notes this day")}</div>
            ) : degraded ? (
              <div className="owb-card-excerpt">{excerpt}</div>
            ) : (
              <orca.components.Block
                panelId={panelId}
                blockId={card.blockId}
                blockLevel={0}
                indentLevel={0}
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
