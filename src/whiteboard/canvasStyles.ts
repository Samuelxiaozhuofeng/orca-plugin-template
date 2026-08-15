import { CARD_WIDTH, GRID_GAP, WEEKDAY_HEADER_H } from "./layout";

export const CANVAS_CSS = `
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

.owb-viewport.is-marqueeing,
.owb-viewport.is-draw-area {
  cursor: crosshair;
}

.owb-marquee {
  position: absolute;
  z-index: 30;
  box-sizing: border-box;
  pointer-events: none;
  background: color-mix(in oklab, var(--orca-color-primary-5) 15%, transparent);
  border: 1.5px solid var(--orca-color-primary-5);
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
  background: var(--orca-color-primary-5);
}

.owb-guide-x {
  top: 0;
  width: 1.5px;
  height: 100%;
}

.owb-guide-y {
  left: 0;
  width: 100%;
  height: 1.5px;
}

.owb-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image: radial-gradient(
    circle,
    color-mix(in srgb, var(--orca-color-border) var(--owb-dot-alpha), transparent) 1.2px,
    transparent 1.6px
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

.owb-lod-hint {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 20;
  pointer-events: none;
  max-width: min(380px, calc(100% - 24px));
  padding: 6px 10px;
  border-radius: var(--owb-radius-btn, 4px);
  font-size: 12px;
  line-height: 1.35;
  color: var(--orca-color-text-2);
  background: color-mix(in oklab, var(--orca-color-bg-1) 88%, transparent);
  border: 1px solid var(--orca-color-border);
}

.owb-card-search {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  width: min(360px, calc(100% - 32px));
  padding: 8px;
  border-radius: var(--owb-radius-card, 6px);
  background: var(--orca-color-bg-1);
  border: 1.5px solid var(--orca-color-border);
  box-shadow: 3px 3px 0 0 var(--orca-color-border);
}

.owb-card-search-input {
  box-sizing: border-box;
  width: 100%;
  padding: 7px 10px;
  border: 1.5px solid var(--orca-color-border);
  border-radius: var(--owb-radius-btn, 4px);
  background: var(--orca-color-bg-1);
  color: var(--orca-color-text-1);
  font-size: 13px;
  font-weight: 700;
}

.owb-card-search-input:focus {
  border-color: var(--orca-color-primary-5, #00a896);
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--orca-color-primary-5, #00a896) 25%, transparent);
}

.owb-card-search-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 260px;
  margin-top: 6px;
  overflow: auto;
}

.owb-card-search-item {
  appearance: none;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 7px 8px;
  border: 1.5px solid transparent;
  border-radius: var(--owb-radius-btn, 4px);
  background: transparent;
  color: var(--orca-color-text-1);
  cursor: pointer;
  text-align: left;
}

.owb-card-search-item.is-active,
.owb-card-search-item:hover {
  background: var(--orca-color-warning-5, #f4a259);
  color: #111417;
  border-color: var(--orca-color-border);
}

.owb-card-search-title {
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.owb-card-search-snippet {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.75;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.owb-card-search-hint {
  margin-top: 6px;
  padding: 4px 6px;
  font-size: 12px;
  color: var(--orca-color-text-3);
}

.owb-selection-bar {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 22;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--owb-radius-card, 6px);
  background: var(--orca-color-bg-1);
  border: 1.5px solid var(--orca-color-border);
  box-shadow: 3px 3px 0 0 var(--orca-color-border);
}

.owb-selection-bar-count {
  font-size: 12px;
  font-weight: 700;
  color: var(--orca-color-text-2);
  white-space: nowrap;
}

.owb-selection-bar-colors {
  display: flex;
  align-items: center;
  gap: 5px;
}

.owb-selection-bar-sep {
  width: 1px;
  height: 16px;
  background: var(--orca-color-border);
}

.owb-selection-bar-btn {
  appearance: none;
  border: 1.5px solid var(--orca-color-border);
  background: var(--orca-color-bg-1);
  color: var(--orca-color-text-1);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
  padding: 4px 8px;
  border-radius: var(--owb-radius-btn, 4px);
  cursor: pointer;
  white-space: nowrap;
}

.owb-selection-bar-btn:hover {
  background: var(--orca-color-warning-5, #f4a259);
  color: #111417;
}
`.trim();
