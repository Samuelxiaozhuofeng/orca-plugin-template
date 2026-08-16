import { ADD_TO_BOARD_CSS } from "./addToBoardStyles";
import { AREA_CSS } from "./areaStyles";
import { BOARD_TITLE_CSS } from "./boardTitleStyles";
import { CANVAS_CSS } from "./canvasStyles";
import { CARD_EDITOR_CSS } from "./cardEditorStyles";
import { BOARD_CARD_CSS } from "./boardCardStyles";
import { CARD_CSS } from "./cardStyles";
import { CARD_ROW_ON_BOARD_CSS } from "./cardRowOnBoard";
import { CARD_BACK_CSS } from "./cardParentOnBoard";
import { CARD_CHROME_CSS } from "./cardToolbarStyles";
import { DIALOG_CSS } from "./dialogStyles";
import { EDGE_CSS } from "./edgeStyles";
import { PANEL_CSS } from "./panelStyles";
import { SELECTION_TOOLBAR_CSS } from "./selectionToolbarStyles";
import { RELATION_MAP_CSS } from "./relationMapStyles";

export const WHITEBOARD_CSS_ROLE = "whiteboard.canvas.styles";

const REDUCED_MOTION_CSS = `
@media (prefers-reduced-motion: reduce) {
  .owb-panel,
  .owb-panel * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
`.trim();

const SHELL_CSS = [
  PANEL_CSS,
  CANVAS_CSS,
  DIALOG_CSS,
  REDUCED_MOTION_CSS,
].join("\n\n");

export const WHITEBOARD_CSS = [
  SHELL_CSS,
  CARD_CSS,
  BOARD_CARD_CSS,
  CARD_ROW_ON_BOARD_CSS,
  CARD_BACK_CSS,
  CARD_EDITOR_CSS,
  CARD_CHROME_CSS,
  EDGE_CSS,
  AREA_CSS,
  ADD_TO_BOARD_CSS,
  BOARD_TITLE_CSS,
  SELECTION_TOOLBAR_CSS,
  RELATION_MAP_CSS,
].join("\n");

export function injectWhiteboardStyles(): void {
  orca.themes.injectCSS(WHITEBOARD_CSS, WHITEBOARD_CSS_ROLE);
}

export function removeWhiteboardStyles(): void {
  orca.themes.removeCSS(WHITEBOARD_CSS_ROLE);
}
