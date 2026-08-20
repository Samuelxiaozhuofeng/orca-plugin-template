import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { openCardInSidePanel, openCardInThisPanel } from "./CardToolbar";
import { invokeCollectSelectedOnActivePanel } from "./collectIntoBoardApply";
import { invokeWrapSelectedOnActivePanel } from "./useCanvasAreas";
import type { WhiteboardCard } from "./data";

export function CardMenu({
  card,
  panelId,
  selected,
  selectedCount,
  extractRowId,
  onExtractRow,
  onFitContentHeight,
  close,
}: {
  card: WhiteboardCard;
  panelId: string;
  selected: boolean;
  selectedCount: number;
  extractRowId: DbId | null;
  onExtractRow?: (blockId: DbId, sourceCard: WhiteboardCard) => void;
  onFitContentHeight: () => void;
  close: () => void;
}) {
  return (
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
      {onExtractRow != null && extractRowId != null && extractRowId !== card.blockId ? (
        <orca.components.MenuText
          title={t("Extract as card")}
          onClick={() => {
            close();
            onExtractRow(extractRowId, card);
          }}
        />
      ) : null}
      {selected && selectedCount >= 1 ? (
        <orca.components.MenuText
          title={t("Group into section")}
          onClick={() => {
            close();
            invokeWrapSelectedOnActivePanel();
          }}
        />
      ) : null}
      {selected && selectedCount >= 2 ? (
        <orca.components.MenuText
          title={t("Collect into new whiteboard")}
          onClick={() => {
            close();
            invokeCollectSelectedOnActivePanel();
          }}
        />
      ) : null}
      <orca.components.MenuSeparator />
      <orca.components.MenuText
        title={t("Fit content height")}
        onClick={() => {
          close();
          onFitContentHeight();
        }}
      />
    </orca.components.Menu>
  );
}
