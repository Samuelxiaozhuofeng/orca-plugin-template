import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  cardDateMeta,
  clampCardSize,
  MIN_CARD_HEIGHT,
  type WhiteboardCard,
} from "./data";
import { cachedBlockPlainText, cardExcerpt } from "./viewTransform";

const { useEffect, useLayoutEffect, useRef } = window.React;
const { useSnapshot } = window.Valtio;

type Props = {
  panelId: string;
  card: WhiteboardCard;
  degraded: boolean;
  editing: boolean;
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  onStartEdit: (blockId: DbId) => void;
  onEndEdit: () => void;
  onMoveEnd: (blockId: DbId, x: number, y: number) => void;
  onResizeEnd: (blockId: DbId, w: number, h: number) => void;
};

type CardBox = { x: number; y: number; w: number; h: number };

function JournalEditor({ blockId }: { blockId: DbId }) {
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

function applyCardBox(el: HTMLElement | null, box: CardBox): void {
  if (el == null) return;
  el.style.left = `${box.x}px`;
  el.style.top = `${box.y}px`;
  el.style.width = `${box.w}px`;
  el.style.height = `${box.h}px`;
}

export function JournalCard({
  panelId,
  card,
  degraded,
  editing,
  pointerToWorld,
  onStartEdit,
  onEndEdit,
  onMoveEnd,
  onResizeEnd,
}: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const liveRef = useRef<CardBox>({
    x: card.x,
    y: card.y,
    w: card.w,
    h: card.h,
  });
  const draggingRef = useRef(false);
  const resizingRef = useRef(false);
  const rafRef = useRef(0);
  const listenersRef = useRef<{
    move: ((event: MouseEvent) => void) | null;
    up: ((event: MouseEvent) => void) | null;
  }>({ move: null, up: null });

  if (!draggingRef.current && !resizingRef.current) {
    liveRef.current = { x: card.x, y: card.y, w: card.w, h: card.h };
  }

  const { blocks } = useSnapshot(orca.state);
  const journal = blocks[card.blockId];
  const isEmptyJournal =
    journal != null &&
    !(typeof journal.text === "string" && journal.text.trim().length > 0) &&
    (journal.children?.length ?? 0) === 0;
  const dateMeta = cardDateMeta(card.date);
  const excerpt = cardExcerpt(cachedBlockPlainText(card.blockId, blocks));

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (el == null) return;
    applyCardBox(el, liveRef.current);
    el.classList.toggle("is-dragging", draggingRef.current);
    el.classList.toggle("is-resizing", resizingRef.current);
  });

  useEffect(() => {
    return () => {
      if (rafRef.current !== 0) window.cancelAnimationFrame(rafRef.current);
      const { move, up } = listenersRef.current;
      if (move) window.removeEventListener("mousemove", move);
      if (up) window.removeEventListener("mouseup", up);
    };
  }, []);

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

  const paintBox = () => {
    if (rafRef.current !== 0) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = 0;
      applyCardBox(cardRef.current, liveRef.current);
    });
  };

  const detachPointer = () => {
    const { move, up } = listenersRef.current;
    if (move) window.removeEventListener("mousemove", move);
    if (up) window.removeEventListener("mouseup", up);
    listenersRef.current = { move: null, up: null };
    if (rafRef.current !== 0) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  };

  const onTitleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const originX = liveRef.current.x;
    const originY = liveRef.current.y;
    const start = pointerToWorld(event.clientX, event.clientY);
    draggingRef.current = true;
    cardRef.current?.classList.add("is-dragging");

    const onMove = (moveEvent: MouseEvent) => {
      const now = pointerToWorld(moveEvent.clientX, moveEvent.clientY);
      liveRef.current = {
        ...liveRef.current,
        x: originX + now.x - start.x,
        y: originY + now.y - start.y,
      };
      paintBox();
    };

    const onUp = (upEvent: MouseEvent) => {
      detachPointer();
      draggingRef.current = false;
      cardRef.current?.classList.remove("is-dragging");
      const now = pointerToWorld(upEvent.clientX, upEvent.clientY);
      const nextX = originX + now.x - start.x;
      const nextY = originY + now.y - start.y;
      liveRef.current = { ...liveRef.current, x: nextX, y: nextY };
      applyCardBox(cardRef.current, liveRef.current);
      if (nextX === card.x && nextY === card.y) return;
      onMoveEnd(card.blockId, nextX, nextY);
    };

    listenersRef.current = { move: onMove, up: onUp };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onResizeMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const originW = liveRef.current.w;
    const originH = liveRef.current.h;
    const start = pointerToWorld(event.clientX, event.clientY);
    resizingRef.current = true;
    cardRef.current?.classList.add("is-resizing");

    const onMove = (moveEvent: MouseEvent) => {
      const now = pointerToWorld(moveEvent.clientX, moveEvent.clientY);
      liveRef.current = {
        ...liveRef.current,
        ...clampCardSize(originW + now.x - start.x, originH + now.y - start.y),
      };
      paintBox();
    };

    const onUp = (upEvent: MouseEvent) => {
      detachPointer();
      resizingRef.current = false;
      cardRef.current?.classList.remove("is-resizing");
      const now = pointerToWorld(upEvent.clientX, upEvent.clientY);
      const next = clampCardSize(
        originW + now.x - start.x,
        originH + now.y - start.y,
      );
      liveRef.current = { ...liveRef.current, ...next };
      applyCardBox(cardRef.current, liveRef.current);
      if (next.w === card.w && next.h === card.h) return;
      onResizeEnd(card.blockId, next.w, next.h);
    };

    listenersRef.current = { move: onMove, up: onUp };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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
    onResizeEnd(card.blockId, card.w, nextH);
  };

  const className = [
    "owb-card",
    draggingRef.current ? "is-dragging" : "",
    resizingRef.current ? "is-resizing" : "",
    editing ? "is-editing" : "",
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
        </orca.components.Menu>
      )}
    >
      {(open) => (
        <div
          ref={cardRef}
          className={className}
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
          onContextMenu={(event) => {
            if (editing) return;
            open(event);
          }}
        >
          <div className="owb-card-title" onMouseDown={onTitleMouseDown}>
            <span className="owb-card-title-main">
              {dateMeta.isToday ? <span className="owb-card-today-dot" /> : null}
              <span className="owb-card-date">{dateMeta.date}</span>
              <span
                className={`owb-card-weekday${dateMeta.isWeekend ? " is-weekend" : ""}`}
              >
                {dateMeta.weekday}
              </span>
            </span>
            {editing ? (
              <span className="owb-card-edit-badge">{t("Editing")}</span>
            ) : null}
          </div>
          <div
            className="owb-card-body"
            title={editing ? undefined : t("Double-click to edit")}
            onDoubleClick={() => {
              if (!editing) onStartEdit(card.blockId);
            }}
          >
            {editing ? (
              <JournalEditor blockId={card.blockId} />
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
          <div
            className="owb-card-resize"
            title={t("Drag to resize")}
            onMouseDown={onResizeMouseDown}
          />
        </div>
      )}
    </orca.components.ContextMenu>
  );
}
