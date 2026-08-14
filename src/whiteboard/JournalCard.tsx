import type { DbId } from "../orca.d.ts";
import { formatCardTitle, type WhiteboardCard } from "./data";

const { useState } = window.React;

type Props = {
  panelId: string;
  card: WhiteboardCard;
  scale: number;
  onMoveEnd: (blockId: DbId, x: number, y: number) => Promise<void>;
};

export function JournalCard({ panelId, card, scale, onMoveEnd }: Props) {
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const x = draft?.x ?? card.x;
  const y = draft?.y ?? card.y;
  const zoom = scale === 0 ? 1 : scale;

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

  return (
    <div
      className={`owb-card${draft ? " is-dragging" : ""}`}
      style={{ left: x, top: y, width: card.w, height: card.h }}
    >
      <div className="owb-card-title" onMouseDown={onTitleMouseDown}>
        {formatCardTitle(card.date)}
      </div>
      <div className="owb-card-body">
        <orca.components.Block
          panelId={panelId}
          blockId={card.blockId}
          blockLevel={0}
          indentLevel={0}
        />
      </div>
    </div>
  );
}
