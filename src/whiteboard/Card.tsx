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
import type { ArrangeAction } from "./selection";
import { cachedBlockPlainText, cardExcerpt } from "./viewTransform";

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
    patch: { x?: number; y?: number; w?: number; h?: number },
  ) => void;
  onArrange: (action: ArrangeAction) => void;
  onSelectOnly: (blockId: DbId) => void;
};

type CardBox = { x: number; y: number; w: number; h: number };

function CardEditor({ blockId }: { blockId: DbId }) {
  const { panelRenderers } = useSnapshot(orca.state);
  const BlockPanel = panelRenderers.block;
  if (BlockPanel == null) {
    return <div className="owb-card-editor-missing">{t("Editor unavailable")}</div>;
  }
  return (
    <div className="owb-card-editor">
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
      pointerToWorld,
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
    const title = el.querySelector(".owb-card-title") as HTMLElement | null;
    const inner = el.querySelector(
      ".orca-block, .orca-block-editor-blocks, .owb-card-excerpt",
    ) as HTMLElement | null;
    const body = el.querySelector(".owb-card-body") as HTMLElement | null;
    const contentH =
      inner?.scrollHeight ?? body?.scrollHeight ?? MIN_CARD_HEIGHT;
    const nextH = Math.max(
      MIN_CARD_HEIGHT,
      (title?.offsetHeight ?? 0) + contentH + 8,
    );
    if (nextH === card.h) return;
    onPatchCard(card.blockId, { w: card.w, h: nextH });
  };

  const className = [
    "owb-card",
    editing ? "is-editing" : "",
    selected ? "is-selected" : "",
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
        </div>
      )}
    </orca.components.ContextMenu>
  );
}
