import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  mountAddToBoardHost as mountHost,
  openAddToBoard,
  openLocatePicker,
  openQueryToBoard,
  openTagToBoard,
} from "./addToBoardHost";
import {
  findBoardsContainingBlock,
  findOpenBoardPanelId,
} from "./boards";
import { requestCardFocus } from "./cardFocus";
import { PANEL_TYPE } from "./data";
import { isQueryBlock } from "./queryToBoard";

const ADD_COMMAND = "addToWhiteboard";
const LOCATE_COMMAND = "locateOnWhiteboard";
const TAG_COMMAND = "tagToWhiteboard";
const QUERY_COMMAND = "queryToWhiteboard";

export { openAddToBoard, openQueryToBoard, openTagToBoard };

export function addToBoardCommandId(pluginName: string): string {
  return `${pluginName}.${ADD_COMMAND}`;
}

export function locateOnBoardCommandId(pluginName: string): string {
  return `${pluginName}.${LOCATE_COMMAND}`;
}

export function tagToBoardCommandId(pluginName: string): string {
  return `${pluginName}.${TAG_COMMAND}`;
}

export function queryToBoardCommandId(pluginName: string): string {
  return `${pluginName}.${QUERY_COMMAND}`;
}

export function AddToBoardMenuItem(props: {
  blockIds: DbId[];
  close: () => void;
}): React.ReactNode {
  return (
    <orca.components.MenuText
      title={t("Add to whiteboard…")}
      preIcon="ti ti-chalkboard"
      onClick={() => {
        props.close();
        openAddToBoard(props.blockIds);
      }}
    />
  );
}

export function LocateOnBoardMenuItem(props: {
  blockId: DbId;
  close: () => void;
}): React.ReactNode {
  return (
    <orca.components.MenuText
      title={t("Locate on whiteboard")}
      preIcon="ti ti-focus-2"
      onClick={() => {
        props.close();
        void locateBlockOnWhiteboard(props.blockId);
      }}
    />
  );
}

export function TagToBoardMenuItem(props: {
  tagBlock: Block;
  close: () => void;
}): React.ReactElement {
  return (
    <orca.components.MenuText
      title={t("Spread onto whiteboard…")}
      preIcon="ti ti-layout-grid"
      onClick={() => {
        props.close();
        openTagToBoard(props.tagBlock);
      }}
    />
  );
}

export function QueryToBoardMenuItem(props: {
  blockId: DbId;
  close: () => void;
}): React.ReactNode {
  const block = orca.state.blocks[props.blockId];
  if (block == null || !isQueryBlock(block)) return null;
  return (
    <orca.components.MenuText
      title={t("Spread onto whiteboard…")}
      preIcon="ti ti-layout-grid"
      onClick={() => {
        props.close();
        openQueryToBoard(props.blockId);
      }}
    />
  );
}

export function jumpToBoardCard(boardId: DbId, cardBlockId: DbId): void {
  requestCardFocus(boardId, cardBlockId);
  const openId = findOpenBoardPanelId(orca.state.panels, boardId);
  if (openId != null) {
    orca.nav.switchFocusTo(openId);
    return;
  }
  orca.nav.openInLastPanel(PANEL_TYPE, { blockId: boardId });
}

export async function locateBlockOnWhiteboard(blockId: DbId): Promise<void> {
  try {
    const hits = await findBoardsContainingBlock(blockId);
    if (hits.length === 0) {
      orca.notify("info", t("This block is not on any whiteboard yet"), {
        title: t("Add to whiteboard…"),
        action: () => openAddToBoard([blockId]),
      });
      return;
    }
    if (hits.length === 1) {
      jumpToBoardCard(hits[0].boardId, hits[0].cardBlockId);
      return;
    }
    openLocatePicker(hits);
  } catch (err: unknown) {
    console.error("[whiteboard] locate on whiteboard failed", err);
    orca.notify("error", t("Failed to find this block on whiteboards"));
  }
}

export function mountAddToBoardHost(): () => void {
  return mountHost({ onJump: jumpToBoardCard });
}
