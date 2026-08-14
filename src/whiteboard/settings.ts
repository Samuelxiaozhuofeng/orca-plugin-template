import type { PluginSettingsSchema } from "../orca.d.ts";
import { t } from "../libs/l10n";

const { useSnapshot } = window.Valtio;

export type MouseScheme = "standard" | "rightDrag";

export const DEFAULT_BOARD_TAG = "whiteboard";

export type WhiteboardSettings = {
  mouseScheme: MouseScheme;
  showAlignGuides: boolean;
  showReferenceEdges: boolean;
  markOutlineBlocks: boolean;
  autoTagNewBoards: boolean;
  boardTag: string;
};

const DEFAULTS: WhiteboardSettings = {
  mouseScheme: "standard",
  showAlignGuides: false,
  showReferenceEdges: true,
  markOutlineBlocks: true,
  autoTagNewBoards: true,
  boardTag: DEFAULT_BOARD_TAG,
};

let pluginName = "";

export function bindWhiteboardPlugin(name: string): void {
  pluginName = name;
}

export function whiteboardSettingsSchema(): PluginSettingsSchema {
  return {
    mouseScheme: {
      label: t("Mouse controls"),
      description: t(
        "How left and right mouse buttons move cards and pan the canvas.",
      ),
      type: "singleChoice",
      defaultValue: DEFAULTS.mouseScheme,
      choices: [
        {
          label: t("Standard: left-drag cards, space/middle-drag to pan"),
          value: "standard",
        },
        {
          label: t(
            "Right-drag: right-drag cards to move, right-drag blank to pan",
          ),
          value: "rightDrag",
        },
      ],
    },
    showAlignGuides: {
      label: t("Show alignment guides"),
      description: t(
        "Draw alignment lines while dragging. Snapping stays on either way.",
      ),
      type: "boolean",
      defaultValue: DEFAULTS.showAlignGuides,
    },
    showReferenceEdges: {
      label: t("Show reference connections"),
      description: t(
        "Draw faint dashed lines when a card's notes already reference another card on this board.",
      ),
      type: "boolean",
      defaultValue: DEFAULTS.showReferenceEdges,
    },
    markOutlineBlocks: {
      label: t("Mark outline blocks already on a whiteboard"),
      description: t(
        "Show a small mark next to outline rows that already have a card on a whiteboard.",
      ),
      type: "boolean",
      defaultValue: DEFAULTS.markOutlineBlocks,
    },
    autoTagNewBoards: {
      label: t("Tag new whiteboards"),
      description: t(
        "Automatically add this tag so new whiteboards appear in Orca's tag sidebar.",
      ),
      type: "boolean",
      defaultValue: DEFAULTS.autoTagNewBoards,
    },
    boardTag: {
      label: t("Whiteboard tag"),
      description: t("Tag name without #. Default is whiteboard."),
      type: "string",
      defaultValue: DEFAULTS.boardTag,
    },
  };
}

export function readWhiteboardSettings(
  raw: Record<string, unknown> | undefined,
): WhiteboardSettings {
  return {
    mouseScheme: raw?.mouseScheme === "rightDrag" ? "rightDrag" : "standard",
    showAlignGuides: raw?.showAlignGuides === true,
    showReferenceEdges: raw?.showReferenceEdges !== false,
    markOutlineBlocks: raw?.markOutlineBlocks !== false,
    autoTagNewBoards: raw?.autoTagNewBoards !== false,
    boardTag: typeof raw?.boardTag === "string" ? raw.boardTag : DEFAULTS.boardTag,
  };
}

export function currentWhiteboardSettings(): WhiteboardSettings {
  if (!pluginName) return DEFAULTS;
  return readWhiteboardSettings(
    orca.state.plugins[pluginName]?.settings as Record<string, unknown> | undefined,
  );
}

export function useWhiteboardSettings(): WhiteboardSettings {
  const { plugins } = useSnapshot(orca.state);
  if (!pluginName) return DEFAULTS;
  return readWhiteboardSettings(
    plugins[pluginName]?.settings as Record<string, unknown> | undefined,
  );
}
