import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import type { BoardCardInfo } from "./boardCardView";
import type { CardBlockView } from "./blockWatch";
import { CardBlockTree } from "./CardBlockTree";
import { CardEditor } from "./CardEditor";
import { CardLoadNotice } from "./CardLoadNotice";
import { requestCardEditCaret } from "./cardClickEdit";
import type { CardLoadCause, CardLoadScope } from "./cardTreeLoad";
import { CARD_ROW_FOCUS_CLASS } from "./cardRowOnBoard";
import { openBoard, type WhiteboardCard } from "./data";

export function openBoardFromCardEvent(
  event: { metaKey: boolean; ctrlKey: boolean },
  blockId: DbId,
  panelId: string,
): void {
  openBoard(blockId, panelId, event.metaKey || event.ctrlKey);
}

export function BoardCardBody({
  board,
  panelId,
  blockId,
}: {
  board: BoardCardInfo;
  panelId: string;
  blockId: DbId;
}) {
  const onOpen = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    openBoardFromCardEvent(event, blockId, panelId);
  };
  const countError = board.count == null;

  return (
    <div className="owb-card-body owb-board-card-body">
      <div className="owb-board-card-main">
        <i className="ti ti-chalkboard owb-board-card-icon" />
        <span className="owb-board-card-name">{board.name}</span>
      </div>
      <span
        className={
          countError ? "owb-board-card-count is-error" : "owb-board-card-count"
        }
      >
        {countError
          ? t("Board data unreadable; saving stopped")
          : board.count === 0
            ? t("No cards yet")
            : t("${count} cards", { count: String(board.count) })}
      </span>
      <span
        className="owb-board-card-open"
        onMouseDown={(event: React.MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onDoubleClick={(event: React.MouseEvent) => event.stopPropagation()}
      >
        <orca.components.Button variant="soft" onClick={onOpen}>
          {t("Open")}
        </orca.components.Button>
      </span>
    </div>
  );
}

type CardBodyProps = {
  panelId: string;
  card: WhiteboardCard;
  treeRev: number;
  hosted: CardBlockView;
  editing: boolean;
  noteGone: boolean;
  fillLoadError: boolean;
  shownNotice: { scope: CardLoadScope; cause: CardLoadCause } | null;
  loadRetrying: boolean;
  isEmptyJournal: boolean;
  promotedKey: string;
  highlightedRowIds?: ReadonlySet<DbId>;
  onStartEdit: (blockId: DbId) => void;
  onRetryLoad?: (blockId: DbId) => void;
  onFocusCard?: (blockId: DbId) => void;
  onStartConnect?: (
    card: WhiteboardCard,
    event: React.MouseEvent,
    mode: "drag" | "click",
    fromBlock?: DbId,
  ) => void;
};

/** Card body: board preview, or the live note tree / editor. */
export function CardBody({
  panelId,
  card,
  treeRev,
  hosted,
  editing,
  noteGone,
  fillLoadError,
  shownNotice,
  loadRetrying,
  isEmptyJournal,
  promotedKey,
  highlightedRowIds,
  onStartEdit,
  onRetryLoad,
  onFocusCard,
  onStartConnect,
}: CardBodyProps) {
  if (hosted.board != null) {
    return (
      <BoardCardBody
        board={hosted.board}
        panelId={panelId}
        blockId={card.blockId}
      />
    );
  }

  return (
    <div
      className="owb-card-body"
      title={editing ? undefined : t("Click to edit")}
      onDoubleClick={(event: React.MouseEvent) => {
        if (editing) return;
        if (
          (event.target as HTMLElement | null)?.closest(
            `.${CARD_ROW_FOCUS_CLASS}`,
          )
        ) {
          return;
        }
        if (noteGone) {
          orca.notify("info", t("This note is gone"));
          return;
        }
        // Double-click enters edit too — aim its caret the same way a single
        // click does, instead of dropping it at the top of the card.
        requestCardEditCaret(card.blockId, event.clientX, event.clientY);
        onStartEdit(card.blockId);
      }}
    >
      {editing && !noteGone ? (
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
          card={card}
          blockId={card.blockId}
          cardHeight={card.h}
          editing={editing}
          promotedKey={promotedKey}
          highlightedRowIds={highlightedRowIds}
          onFocusCard={onFocusCard}
          onStartConnect={onStartConnect}
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
  );
}
