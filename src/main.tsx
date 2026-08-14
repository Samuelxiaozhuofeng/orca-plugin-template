import { setupL10N, t } from "./libs/l10n";
import zhCN from "./translations/zhCN";
import BoardBlock from "./whiteboard/BoardBlock";
import BoardPanel from "./whiteboard/BoardPanel";
import {
  insertedBlockId,
  openBoard,
  PANEL_TYPE,
  WHITEBOARD_TYPE,
} from "./whiteboard/data";
import { flushAllCardWrites } from "./whiteboard/cardPersist";
import { flushAllEdgeWrites } from "./whiteboard/edgePersist";
import {
  bindWhiteboardPlugin,
  whiteboardSettingsSchema,
} from "./whiteboard/settings";
import {
  injectWhiteboardStyles,
  removeWhiteboardStyles,
} from "./whiteboard/styles";

let pluginName: string;

const INSERT_COMMAND = "insertWhiteboard";
const INSERT_SLASH = "insertWhiteboardSlash";

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
  orca.converters.registerBlock("plain", WHITEBOARD_TYPE, () => t("Whiteboard"));

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
    orca.slashCommands.unregisterSlashCommand(commandId(INSERT_SLASH));
  }
  removeWhiteboardStyles();
}
