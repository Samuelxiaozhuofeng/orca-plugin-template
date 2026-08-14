import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  cardDateMeta,
  clampCardSize,
  MIN_CARD_HEIGHT,
  type WhiteboardCard,
} from "./data";

const { useEffect, useRef, useState } = window.React;
const { useSnapshot } = window.Valtio;

type Props = {
  panelId: string;
  card: WhiteboardCard;
  scale: number;
  editing: boolean;
  onStartEdit: (blockId: DbId) => void;
  onEndEdit: () => void;
  onMoveEnd: (blockId: DbId, x: number, y: number) => Promise<void>;
  onResizeEnd: (blockId: DbId, w: number, h: number) => Promise<void>;
};

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

export function JournalCard({
  panelId,
  card,
  scale,
  editing,
  onStartEdit,
  onEndEdit,
  onMoveEnd,
  onResizeEnd,
}: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const x = draft?.x ?? card.x;
  const y = draft?.y ?? card.y;
  const w = size?.w ?? card.w;
  const h = size?.h ?? card.h;
  const zoom = scale === 0 ? 1 : scale;
  const { blocks } = useSnapshot(orca.state);
  const journal = blocks[card.blockId];
  const isEmptyJournal =
    journal != null &&
    !(typeof journal.text === "string" && journal.text.trim().length > 0) &&
    (journal.children?.length ?? 0) === 0;
  const dateMeta = cardDateMeta(card.date);

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

  const onTitleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const originX = x;
    const originY = y;
    const startX = event.clientX;
    const startY = event.clientY;

    const onMove = (moveEvent: MouseEvent) => {
      setDraft({
        x: originX + (moveEvent.clientX - startX) / zoom,
        y: originY + (moveEvent.clientY - startY) / zoom,
      });
    };

    const onUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const nextX = originX + (upEvent.clientX - startX) / zoom;
      const nextY = originY + (upEvent.clientY - startY) / zoom;
      if (nextX === card.x && nextY === card.y) {
        setDraft(null);
        return;
      }
      setDraft({ x: nextX, y: nextY });
      void onMoveEnd(card.blockId, nextX, nextY).finally(() => {
        setDraft(null);
      });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onResizeMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const originW = w;
    const originH = h;
    const startX = event.clientX;
    const startY = event.clientY;

    const onMove = (moveEvent: MouseEvent) => {
      setSize(
        clampCardSize(
          originW + (moveEvent.clientX - startX) / zoom,
          originH + (moveEvent.clientY - startY) / zoom,
        ),
      );
    };

    const onUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const next = clampCardSize(
        originW + (upEvent.clientX - startX) / zoom,
        originH + (upEvent.clientY - startY) / zoom,
      );
      if (next.w === card.w && next.h === card.h) {
        setSize(null);
        return;
      }
      setSize(next);
      void onResizeEnd(card.blockId, next.w, next.h).finally(() => {
        setSize(null);
      });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const fitContentHeight = () => {
    const el = cardRef.current;
    if (!el) return;
    const title = el.querySelector(".owb-card-title") as HTMLElement | null;
    const inner = el.querySelector(
      ".orca-block, .orca-block-editor-blocks",
    ) as HTMLElement | null;
    const body = el.querySelector(".owb-card-body") as HTMLElement | null;
    const contentH =
      inner?.scrollHeight ?? body?.scrollHeight ?? MIN_CARD_HEIGHT;
    const nextH = Math.max(
      MIN_CARD_HEIGHT,
      (title?.offsetHeight ?? 0) + contentH + 8,
    );
    if (nextH === card.h) return;
    void onResizeEnd(card.blockId, card.w, nextH);
  };

  const className = [
    "owb-card",
    draft ? "is-dragging" : "",
    size ? "is-resizing" : "",
    editing ? "is-editing" : "",
  ]
    .filter(Boolean)
    .join(" ");

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
          style={{ left: x, top: y, width: w, height: h }}
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
