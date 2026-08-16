import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { cardDateMeta, type WhiteboardCard } from "./data";

const { useSnapshot } = window.Valtio;

const PARENT_WALK_LIMIT = 20;

function firstAlias(block: Block | undefined): string | null {
  const alias = block?.aliases?.[0];
  if (typeof alias === "string" && alias.trim()) return alias.trim();
  return null;
}

export function blockCardTitle(
  blockId: DbId,
  blocks: { [id: number]: Block | undefined },
): string {
  const self = blocks[blockId];
  const own = firstAlias(self);
  if (own != null) return own;

  const seen = new Set<DbId>();
  let parentId = self?.parent;
  for (let i = 0; i < PARENT_WALK_LIMIT && parentId != null; i++) {
    if (seen.has(parentId)) break;
    seen.add(parentId);
    const parent = blocks[parentId];
    const alias = firstAlias(parent);
    if (alias != null) return alias;
    parentId = parent?.parent;
  }

  const text = typeof self?.text === "string" ? self.text.trim() : "";
  if (text) return text;
  return t("Untitled");
}

function JournalBadge({ date }: { date: string }) {
  const dateMeta = cardDateMeta(date);
  return (
    <div
      className={`owb-card-journal-badge${dateMeta.isWeekend ? " is-weekend" : ""}${
        dateMeta.isToday ? " is-today" : ""
      }`}
      title={dateMeta.date}
    >
      {dateMeta.isToday ? <span className="owb-card-today-dot" /> : null}
      <span className="owb-card-badge-weekday">{dateMeta.weekday || dateMeta.date}</span>
    </div>
  );
}

function BlockTitle({
  blockId,
  isBoard,
}: {
  blockId: DbId;
  isBoard: boolean;
}) {
  const { blocks } = useSnapshot(orca.state);
  const title = blockCardTitle(blockId, blocks);
  const icon = isBoard ? "ti ti-chalkboard" : "ti ti-file-text";
  return (
    <div className="owb-card-header">
      <span className="owb-card-title-main">
        <i className={`${icon} owb-card-page-icon`} />
        <span className="owb-card-page">{title}</span>
      </span>
    </div>
  );
}

export function CardTitle({
  card,
  isBoard = false,
}: {
  card: WhiteboardCard;
  editing: boolean;
  isBoard?: boolean;
}) {
  if (card.kind === "journal" && typeof card.date === "string") {
    return <JournalBadge date={card.date} />;
  }
  return <BlockTitle blockId={card.blockId} isBoard={isBoard} />;
}
