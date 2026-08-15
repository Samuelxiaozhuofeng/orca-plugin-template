import { setupL10N, t } from "./libs/l10n";
import zhCN from "./translations/zhCN";
import {
  AddToBoardMenuItem,
  addToBoardCommandId,
  locateBlockOnWhiteboard,
  LocateOnBoardMenuItem,
  locateOnBoardCommandId,
  mountAddToBoardHost,
  TagToBoardMenuItem,
  tagToBoardCommandId,
} from "./whiteboard/addToBoard";
import { startBlockMarks, stopBlockMarks } from "./whiteboard/blockMarks";
import { clearAllPendingCardFocus } from "./whiteboard/cardFocus";
import BoardBlock from "./whiteboard/BoardBlock";
import BoardPanel from "./whiteboard/BoardPanel";
import {
  boardName,
  insertedBlockId,
  openBoard,
  PANEL_TYPE,
  WHITEBOARD_TYPE,
} from "./whiteboard/data";
import {
  mountOpenBoardHost,
  openBoardPicker,
} from "./whiteboard/openBoardDialog";
import { flushAllCardWrites } from "./whiteboard/cardPersist";
import { flushAllEdgeWrites } from "./whiteboard/edgePersist";
import { tagNewWhiteboard } from "./whiteboard/boardTag";
import {
  bindWhiteboardPlugin,
  whiteboardSettingsSchema,
} from "./whiteboard/settings";
import {
  injectWhiteboardStyles,
  removeWhiteboardStyles,
} from "./whiteboard/styles";

let pluginName: string;
let unmountAddToBoard: (() => void) | null = null;
let unmountOpenBoard: (() => void) | null = null;

const INSERT_COMMAND = "insertWhiteboard";
const INSERT_SLASH = "insertWhiteboardSlash";
const LOCATE_COMMAND = "locateBlockOnWhiteboard";
const OPEN_COMMAND = "openWhiteboard";
const OPEN_HEADBAR = "openWhiteboardButton";
const LOCATE_SHORTCUT = "alt+shift+w";

function commandId(name: string): string {
  return `${pluginName}.${name}`;
}

export async function load(_name: string) {
  pluginName = _name;
  bindWhiteboardPlugin(_name);

  setupL10N(orca.state.locale, { "zh-CN": zhCN });
  await orca.plugins.setSettingsSchema(pluginName, whiteboardSettingsSchema());
  injectWhiteboardStyles();

  orca.panels.registerPanel(PANEL_TYPE, BoardPanel);
  orca.renderers.registerBlock(WHITEBOARD_TYPE, false, BoardBlock);
  orca.converters.registerBlock("plain", WHITEBOARD_TYPE, (_content, _repr, block) =>
    boardName(block),
  );

  orca.commands.registerEditorCommand(
    commandId(INSERT_COMMAND),
    async ([panelId, _rootBlockId, cursor]) => {
      if (!cursor?.anchor) {
        orca.notify("warn", t("Place the cursor first"));
        return null;
      }
      const currentBlock = orca.state.blocks[cursor.anchor.blockId];
      if (!currentBlock) {
        orca.notify("warn", t("Place the cursor first"));
        return null;
      }

      const inserted = await orca.commands.invokeEditorCommand(
        "core.editor.insertBlock",
        null,
        currentBlock,
        "after",
        [{ t: "t", v: t("Untitled whiteboard") }],
        { type: WHITEBOARD_TYPE },
      );
      const newId = insertedBlockId(inserted);
      if (newId == null) {
        orca.notify("error", t("Failed to create whiteboard"));
        return null;
      }
      // Tag before opening the board: the whiteboard panel has no editor,
      // so insertTag would no-op after the panel switch.
      await tagNewWhiteboard(newId, cursor);
      openBoard(newId, panelId, false);
      return null;
    },
    () => {},
    { label: t("New whiteboard") },
  );

  orca.slashCommands.registerSlashCommand(commandId(INSERT_SLASH), {
    icon: "ti ti-chalkboard",
    group: t("Insert"),
    title: t("New whiteboard"),
    command: commandId(INSERT_COMMAND),
  });

  const locateId = commandId(LOCATE_COMMAND);
  orca.commands.registerEditorCommand(
    locateId,
    ([_panelId, _rootBlockId, cursor]) => {
      const blockId = cursor?.anchor.blockId;
      if (blockId == null) {
        orca.notify("warn", t("Place the cursor first"));
        return null;
      }
      void locateBlockOnWhiteboard(blockId);
      return null;
    },
    () => {},
    { label: t("Locate on whiteboard") },
  );
  void assignLocateShortcutIfFree(locateId);

  startBlockMarks(pluginName);

  orca.blockMenuCommands.registerBlockMenuCommand(
    addToBoardCommandId(pluginName),
    {
      worksOnMultipleBlocks: true,
      render: (blockIds, _rootBlockId, close) => (
        <AddToBoardMenuItem blockIds={blockIds} close={close} />
      ),
    },
  );
  orca.blockMenuCommands.registerBlockMenuCommand(
    locateOnBoardCommandId(pluginName),
    {
      worksOnMultipleBlocks: false,
      render: (blockId, _rootBlockId, close) => (
        <LocateOnBoardMenuItem blockId={blockId} close={close} />
      ),
    },
  );
  orca.tagMenuCommands.registerTagMenuCommand(
    tagToBoardCommandId(pluginName),
    {
      render: (tagBlock, close) => (
        <TagToBoardMenuItem tagBlock={tagBlock} close={close} />
      ),
    },
  );
  unmountAddToBoard = mountAddToBoardHost();

  const openId = commandId(OPEN_COMMAND);
  orca.commands.registerCommand(
    openId,
    () => {
      openBoardPicker();
    },
    t("Open whiteboard…"),
  );
  orca.headbar.registerHeadbarButton(commandId(OPEN_HEADBAR), () => (
    <orca.components.Button
      variant="plain"
      title={t("Open whiteboard…")}
      onClick={() => void orca.commands.invokeCommand(openId)}
    >
      <i className="ti ti-chalkboard" />
    </orca.components.Button>
  ));
  unmountOpenBoard = mountOpenBoardHost();

  console.log(`${pluginName} loaded.`);
}

export async function unload() {
  await flushAllCardWrites();
  await flushAllEdgeWrites();
  orca.panels.unregisterPanel(PANEL_TYPE);
  orca.renderers.unregisterBlock(WHITEBOARD_TYPE);
  orca.converters.unregisterBlock("plain", WHITEBOARD_TYPE);
  if (pluginName) {
    orca.commands.unregisterEditorCommand(commandId(INSERT_COMMAND));
    orca.commands.unregisterEditorCommand(commandId(LOCATE_COMMAND));
    orca.slashCommands.unregisterSlashCommand(commandId(INSERT_SLASH));
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      addToBoardCommandId(pluginName),
    );
    orca.blockMenuCommands.unregisterBlockMenuCommand(
      locateOnBoardCommandId(pluginName),
    );
    orca.tagMenuCommands.unregisterTagMenuCommand(
      tagToBoardCommandId(pluginName),
    );
    orca.commands.unregisterCommand(commandId(OPEN_COMMAND));
    orca.headbar.unregisterHeadbarButton(commandId(OPEN_HEADBAR));
  }
  unmountAddToBoard?.();
  unmountAddToBoard = null;
  unmountOpenBoard?.();
  unmountOpenBoard = null;
  clearAllPendingCardFocus();
  stopBlockMarks();
  removeWhiteboardStyles();
}

function assignLocateShortcutIfFree(locateId: string): Promise<void> {
  const shortcuts = orca.state.shortcuts;
  if (locateShortcutTaken(shortcuts, locateId)) return Promise.resolve();
  return orca.shortcuts.assign(LOCATE_SHORTCUT, locateId).catch((err: unknown) => {
    console.error("[whiteboard] failed to assign locate shortcut", err);
  });
}

function locateShortcutTaken(
  shortcuts: Record<string, string | undefined>,
  locateId: string,
): boolean {
  const bound = shortcuts[LOCATE_SHORTCUT];
  if (bound != null && bound !== "") return true;
  for (const [key, value] of Object.entries(shortcuts)) {
    if (key === locateId && value != null && value !== "") return true;
    if (value === locateId) return true;
    if (value === LOCATE_SHORTCUT) return true;
  }
  return false;
}
