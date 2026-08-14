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

function JournalTitle({ date }: { date: string }) {
  const dateMeta = cardDateMeta(date);
  return (
    <span className="owb-card-title-main">
      {dateMeta.isToday ? <span className="owb-card-today-dot" /> : null}
      <span className="owb-card-date">{dateMeta.date}</span>
      <span
        className={`owb-card-weekday${dateMeta.isWeekend ? " is-weekend" : ""}`}
      >
        {dateMeta.weekday}
      </span>
    </span>
  );
}

function BlockTitle({ blockId }: { blockId: DbId }) {
  const { blocks } = useSnapshot(orca.state);
  const title = blockCardTitle(blockId, blocks);
  return (
    <span className="owb-card-title-main">
      <i className="ti ti-file-text owb-card-page-icon" />
      <span className="owb-card-page">{title}</span>
    </span>
  );
}

export function CardTitle({
  card,
  editing,
}: {
  card: WhiteboardCard;
  editing: boolean;
}) {
  return (
    <div className="owb-card-title">
      {card.kind === "journal" && typeof card.date === "string" ? (
        <JournalTitle date={card.date} />
      ) : (
        <BlockTitle blockId={card.blockId} />
      )}
      {editing ? (
        <span className="owb-card-edit-badge">{t("Editing")}</span>
      ) : null}
    </div>
  );
}
