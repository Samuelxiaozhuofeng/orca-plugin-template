import { ADD_TO_BOARD_CSS } from "./addToBoardStyles";
import { CARD_EDITOR_CSS } from "./cardEditorStyles";
import { CARD_CSS } from "./cardStyles";
import { CARD_CHROME_CSS } from "./cardToolbarStyles";
import { EDGE_CSS } from "./edgeStyles";
import { CARD_WIDTH, GRID_GAP, WEEKDAY_HEADER_H } from "./layout";

export const WHITEBOARD_CSS_ROLE = "whiteboard.canvas.styles";

const SHELL_CSS = `
.owb-panel {
  --owb-space-1: 4px;
  --owb-space-2: 8px;
  --owb-space-3: 12px;
  --owb-space-4: 16px;
  --owb-space-5: 24px;
  --owb-radius-card: 12px;
  --owb-radius-btn: 8px;
  --owb-radius-sm: 6px;
  --owb-ease: cubic-bezier(0.25, 0.1, 0.25, 1);
  --owb-duration: 150ms;
  --owb-grid: 24px;
  --owb-shadow-rest: 0 1px 2px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.07);
  --owb-shadow-hover: 0 2px 4px rgba(0, 0, 0, 0.06), 0 8px 20px rgba(0, 0, 0, 0.1);
  --owb-shadow-drag: 0 4px 8px rgba(0, 0, 0, 0.08), 0 16px 32px rgba(0, 0, 0, 0.14);
  --owb-shadow-toolbar: 0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.08);
  --owb-dot-alpha: 8%;
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
  background: var(--orca-color-bg-2);
}

@media (prefers-color-scheme: dark) {
  .owb-panel {
    --owb-shadow-rest: 0 1px 2px rgba(0, 0, 0, 0.03), 0 4px 12px rgba(0, 0, 0, 0.04);
    --owb-shadow-hover: 0 2px 4px rgba(0, 0, 0, 0.04), 0 8px 20px rgba(0, 0, 0, 0.06);
    --owb-shadow-drag: 0 4px 8px rgba(0, 0, 0, 0.05), 0 16px 32px rgba(0, 0, 0, 0.08);
    --owb-shadow-toolbar: 0 1px 2px rgba(0, 0, 0, 0.03), 0 8px 24px rgba(0, 0, 0, 0.05);
    --owb-dot-alpha: 5%;
  }
}

.owb-toolbar {
  position: absolute;
  top: var(--owb-space-4);
  left: var(--owb-space-4);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: var(--owb-space-2);
  max-width: calc(100% - 32px);
  padding: var(--owb-space-1) var(--owb-space-2);
  border-radius: 10px;
  background: color-mix(in oklab, var(--orca-color-bg-1) 72%, transparent);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  box-shadow:
    var(--owb-shadow-toolbar),
    0 0 0 1px var(--orca-color-border);
}

.owb-toolbar-title {
  max-width: 200px;
  padding: 0 var(--owb-space-2);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--orca-color-text-1);
}

.owb-toolbar-sep {
  flex: 0 0 1px;
  align-self: stretch;
  margin: 4px 0;
  background: var(--orca-color-border);
}

.owb-toolbar-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--orca-color-text-1);
  font-size: 13px;
  line-height: 1.3;
  padding: var(--owb-space-1) var(--owb-space-2);
  border-radius: var(--owb-radius-btn);
  cursor: pointer;
}

.owb-toolbar-btn:hover:not(:disabled) {
  background: var(--orca-color-menu-highlight);
}

.owb-toolbar-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.owb-zoom {
  display: flex;
  align-items: center;
}

.owb-zoom-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--orca-color-text-1);
  font-size: 13px;
  line-height: 1;
  min-width: 28px;
  height: 26px;
  padding: 0 var(--owb-space-2);
  border-radius: var(--owb-radius-sm);
  cursor: pointer;
}

.owb-zoom-btn:hover {
  background: var(--orca-color-menu-highlight);
}

.owb-zoom-sep {
  width: 1px;
  height: 14px;
  background: var(--orca-color-border);
}

.owb-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--orca-color-text-3);
}

.owb-viewport {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  cursor: default;
  background: var(--orca-color-bg-2);
}

.owb-viewport.is-drop-target {
  box-shadow: inset 0 0 0 2px var(--orca-color-primary-5);
}

.owb-viewport:focus {
  outline: none;
}

.owb-viewport.is-space-pan {
  cursor: grab;
}

.owb-viewport.is-panning {
  cursor: grabbing;
}

.owb-viewport.is-marqueeing {
  cursor: crosshair;
}

.owb-marquee {
  position: absolute;
  z-index: 30;
  box-sizing: border-box;
  pointer-events: none;
  background: color-mix(in oklab, var(--orca-color-primary-5) 10%, transparent);
  box-shadow: inset 0 0 0 1px var(--orca-color-primary-5);
}

.owb-guides {
  position: absolute;
  inset: 0;
  z-index: 25;
  overflow: hidden;
  pointer-events: none;
}

.owb-guide {
  position: absolute;
  background: color-mix(in oklab, var(--orca-color-primary-5) 55%, transparent);
}

.owb-guide-x {
  top: 0;
  width: 1px;
  height: 100%;
}

.owb-guide-y {
  left: 0;
  width: 100%;
  height: 1px;
}

.owb-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image: radial-gradient(
    circle,
    color-mix(in oklab, var(--orca-color-text-3) var(--owb-dot-alpha), transparent) 1px,
    transparent 1.5px
  );
}

.owb-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  transform-origin: 0 0;
}

.owb-canvas-empty {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--owb-space-2);
  pointer-events: none;
  color: var(--orca-color-text-3);
}

.owb-canvas-empty-icon {
  font-size: 28px;
  line-height: 1;
  opacity: 0.8;
}

.owb-canvas-empty-title {
  font-size: 13px;
  font-weight: 600;
}

.owb-canvas-empty-sub {
  font-size: 12px;
  font-weight: 400;
}

.owb-block-card {
  display: flex;
  align-items: center;
  gap: var(--owb-space-2);
  min-height: 32px;
  padding: var(--owb-space-1) var(--owb-space-2);
  border-radius: var(--owb-radius-btn);
  line-height: 1.4;
  cursor: pointer;
}

.owb-block-card:hover {
  background: var(--orca-color-menu-highlight);
}

.owb-block-icon {
  flex: 0 0 auto;
  color: var(--orca-color-text-2);
}

.owb-block-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--orca-color-text-1);
}

.owb-block-count {
  font-size: 12px;
  font-weight: 400;
  color: var(--orca-color-text-2);
}

.owb-block-card .orca-button {
  margin-left: auto;
}

.owb-cal-weekdays {
  position: absolute;
  display: flex;
  gap: ${GRID_GAP}px;
  height: ${WEEKDAY_HEADER_H}px;
  pointer-events: none;
  z-index: 1;
}

.owb-cal-weekday {
  width: ${CARD_WIDTH}px;
  font-size: 11px;
  font-weight: 500;
  line-height: ${WEEKDAY_HEADER_H}px;
  text-align: center;
  color: var(--orca-color-text-3);
  opacity: 0.65;
}

.owb-dialog {
  width: min(440px, calc(100vw - 48px));
  padding: 20px;
  border-radius: 12px;
  background: var(--orca-color-bg-1);
  box-shadow:
    var(--owb-shadow-hover),
    0 0 0 1px var(--orca-color-border);
}

.owb-dialog-title {
  margin-bottom: var(--owb-space-4);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--orca-color-text-1);
}

.owb-dialog-section {
  display: flex;
  flex-direction: column;
  gap: var(--owb-space-2);
  margin-bottom: var(--owb-space-4);
}

.owb-dialog-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--orca-color-text-2);
}

.owb-preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.owb-preset {
  appearance: none;
  border: none;
  background: var(--orca-color-bg-2);
  color: var(--orca-color-text-1);
  font-size: 12px;
  line-height: 1.3;
  padding: 5px 8px;
  border-radius: var(--owb-radius-btn);
  cursor: pointer;
  transition:
    background var(--owb-duration) var(--owb-ease),
    color var(--owb-duration) var(--owb-ease);
}

.owb-preset:hover:not(:disabled) {
  background: var(--orca-color-menu-highlight);
}

.owb-preset.is-active {
  background: color-mix(in oklab, var(--orca-color-primary-5) 14%, transparent);
  color: var(--orca-color-primary-5);
}

.owb-preset:disabled {
  opacity: 0.45;
  cursor: default;
}

.owb-date-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--owb-space-2);
}

.owb-date-btn {
  appearance: none;
  border: none;
  background: var(--orca-color-bg-2);
  color: var(--orca-color-text-1);
  font-size: 13px;
  line-height: 1.3;
  padding: 6px 10px;
  border-radius: var(--owb-radius-btn);
  box-shadow: 0 0 0 1px var(--orca-color-border);
  cursor: pointer;
  transition:
    background var(--owb-duration) var(--owb-ease),
    box-shadow var(--owb-duration) var(--owb-ease);
}

.owb-date-btn:hover:not(:disabled) {
  background: var(--orca-color-menu-highlight);
}

.owb-date-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.owb-date-sep {
  color: var(--orca-color-text-3);
}

.owb-date-count {
  font-size: 12px;
  color: var(--orca-color-text-3);
}

.owb-dialog-warn {
  font-size: 12px;
  line-height: 1.4;
  color: var(--orca-color-text-red);
}

.owb-dialog-hint {
  font-size: 12px;
  line-height: 1.4;
  color: var(--orca-color-text-3);
}

.owb-columns-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--owb-space-2);
}

.owb-check-row {
  display: flex;
  align-items: center;
  gap: var(--owb-space-2);
  margin: var(--owb-space-2) 0 var(--owb-space-4);
  font-size: 13px;
  color: var(--orca-color-text-1);
  cursor: pointer;
}

.owb-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--owb-space-2);
}

@media (prefers-reduced-motion: reduce) {
  .owb-panel,
  .owb-panel * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
`.trim();

export const WHITEBOARD_CSS = [
  SHELL_CSS,
  CARD_CSS,
  CARD_EDITOR_CSS,
  CARD_CHROME_CSS,
  EDGE_CSS,
  ADD_TO_BOARD_CSS,
].join("\n");

export function injectWhiteboardStyles(): void {
  orca.themes.injectCSS(WHITEBOARD_CSS, WHITEBOARD_CSS_ROLE);
}

export function removeWhiteboardStyles(): void {
  orca.themes.removeCSS(WHITEBOARD_CSS_ROLE);
}
