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
`.trim();
