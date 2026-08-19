import type { PluginSettingsSchema } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  controlsModeFromSettings,
  type ControlsMode,
} from "./controlsMode";

export type { ControlsMode };

export const DEFAULT_BOARD_TAG = "whiteboard";

export type EdgeLinkMode = "property" | "child";

export type WhiteboardSettings = {
  mouseScheme: ControlsMode;
  showAlignGuides: boolean;
  showReferenceEdges: boolean;
  markOutlineBlocks: boolean;
  autoTagNewBoards: boolean;
  boardTag: string;
  openWhiteboardPagesAsCanvas: boolean;
  autoLinkEdges: boolean;
  bidirectionalEdgeLinks: boolean;
  edgeLinkMode: EdgeLinkMode;
  prewarmCardEditor: boolean;
};

const DEFAULTS: WhiteboardSettings = {
  mouseScheme: "mouse",
  showAlignGuides: false,
  showReferenceEdges: true,
  markOutlineBlocks: true,
  autoTagNewBoards: true,
  boardTag: DEFAULT_BOARD_TAG,
  openWhiteboardPagesAsCanvas: true,
  autoLinkEdges: true,
  bidirectionalEdgeLinks: true,
  edgeLinkMode: "property",
  prewarmCardEditor: true,
};

export { migrateControlsMode } from "./controlsMode";

let pluginName = "";

export function bindWhiteboardPlugin(name: string): void {
  pluginName = name;
}

export function whiteboardPluginName(): string {
  return pluginName;
}

export function whiteboardSettingsSchema(): PluginSettingsSchema {
  return {
    mouseScheme: {
      label: t("Controls"),
      description: t(
        "Switch this if pan and zoom feel wrong. Mouse mode zooms with the wheel and pans with a right-drag. Trackpad mode pans with two fingers and zooms with a pinch.",
      ),
      type: "singleChoice",
      defaultValue: DEFAULTS.mouseScheme,
      choices: [
        {
          label: t("Mouse: scroll to zoom, right-drag to pan"),
          value: "mouse",
        },
        {
          label: t("Trackpad: two-finger pan, pinch to zoom"),
          value: "trackpad",
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
    openWhiteboardPagesAsCanvas: {
      label: t("Open whiteboard pages as a canvas"),
      description: t(
        "When you open a page whose root block is a whiteboard, show the full canvas instead of the outline preview.",
      ),
      type: "boolean",
      defaultValue: DEFAULTS.openWhiteboardPagesAsCanvas,
    },
    autoLinkEdges: {
      label: t("Create a note reference when connecting cards"),
      description: t(
        "Automatically create a note reference when you draw an arrow. Turn this off to keep lines decorative.",
      ),
      type: "boolean",
      defaultValue: DEFAULTS.autoLinkEdges,
    },
    bidirectionalEdgeLinks: {
      label: t("Link both ends of an arrow"),
      description: t(
        "Also write a reference back from the target note, so both notes show each other in their backlinks. Off: only the source note points at the target.",
      ),
      type: "boolean",
      defaultValue: DEFAULTS.bidirectionalEdgeLinks,
    },
    edgeLinkMode: {
      label: t("How to store the reference"),
      description: t(
        "Property: no extra text in the source note. Child block: insert a child under the source note (older method).",
      ),
      type: "singleChoice",
      defaultValue: DEFAULTS.edgeLinkMode,
      choices: [
        {
          label: t("Property on the source note"),
          value: "property",
        },
        {
          label: t("Child block under the source note"),
          value: "child",
        },
      ],
    },
    prewarmCardEditor: {
      label: t("Preload the editor when hovering a card"),
      description: t(
        "After you rest the pointer on a card, prepare its editor in the background so clicking in feels faster. Turn this off if the app feels heavy.",
      ),
      type: "boolean",
      defaultValue: DEFAULTS.prewarmCardEditor,
    },
  };
}

export function readWhiteboardSettings(
  raw: Record<string, unknown> | undefined,
): WhiteboardSettings {
  return {
    mouseScheme: controlsModeFromSettings(raw),
    showAlignGuides: raw?.showAlignGuides === true,
    showReferenceEdges: raw?.showReferenceEdges !== false,
    markOutlineBlocks: raw?.markOutlineBlocks !== false,
    autoTagNewBoards: raw?.autoTagNewBoards !== false,
    boardTag: typeof raw?.boardTag === "string" ? raw.boardTag : DEFAULTS.boardTag,
    openWhiteboardPagesAsCanvas: raw?.openWhiteboardPagesAsCanvas !== false,
    autoLinkEdges: raw?.autoLinkEdges !== false,
    bidirectionalEdgeLinks: raw?.bidirectionalEdgeLinks !== false,
    edgeLinkMode: raw?.edgeLinkMode === "child" ? "child" : "property",
    prewarmCardEditor: raw?.prewarmCardEditor !== false,
  };
}

export function currentWhiteboardSettings(): WhiteboardSettings {
  if (!pluginName) return DEFAULTS;
  return readWhiteboardSettings(
    orca.state.plugins[pluginName]?.settings as Record<string, unknown> | undefined,
  );
}

export function useWhiteboardSettings(): WhiteboardSettings {
  const { useSnapshot } = window.Valtio;
  const { plugins } = useSnapshot(orca.state);
  if (!pluginName) return DEFAULTS;
  return readWhiteboardSettings(
    plugins[pluginName]?.settings as Record<string, unknown> | undefined,
  );
}
