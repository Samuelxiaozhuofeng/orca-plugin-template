export const AREA_CSS = `
.owb-area-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.owb-area {
  position: absolute;
  box-sizing: border-box;
  pointer-events: none;
  border-radius: 8px;
  border: 1.5px solid color-mix(in oklab, var(--orca-color-primary-5, #00a896) 42%, transparent);
  background: color-mix(in oklab, var(--orca-color-primary-5, #00a896) 9%, transparent);
}

.owb-area.is-selected {
  border-color: var(--orca-color-primary-5, #00a896);
  background: color-mix(in oklab, var(--orca-color-primary-5, #00a896) 14%, transparent);
}

.owb-area.is-resizing,
.owb-area.is-moving {
  transition: none;
}

.owb-area.is-moving .owb-area-title {
  cursor: grabbing;
}

.owb-area-title {
  position: absolute;
  left: 8px;
  top: 4px;
  right: 8px;
  height: 22px;
  display: flex;
  align-items: center;
  pointer-events: auto;
  cursor: grab;
  font-size: 12px;
  font-weight: 600;
  line-height: 22px;
  color: var(--orca-color-text-2);
  user-select: none;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.owb-area.is-selected .owb-area-title {
  color: var(--orca-color-text-1);
}

.owb-area-title-input {
  width: 100%;
  height: 22px;
  margin: 0;
  padding: 0 4px;
  cursor: text;
  border: 1px solid var(--orca-color-primary-5, #00a896);
  border-radius: 3px;
  background: var(--orca-color-bg-1);
  color: var(--orca-color-text-1);
  font: inherit;
  outline: none;
}

.owb-area-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  box-sizing: border-box;
  pointer-events: auto;
  border: 1.5px solid var(--orca-color-primary-5, #00a896);
  background: var(--orca-color-bg-1);
  border-radius: 1px;
  z-index: 1;
}

.owb-area-handle-nw { top: -5px; left: -5px; cursor: nwse-resize; }
.owb-area-handle-ne { top: -5px; right: -5px; cursor: nesw-resize; }
.owb-area-handle-se { bottom: -5px; right: -5px; cursor: nwse-resize; }
.owb-area-handle-sw { bottom: -5px; left: -5px; cursor: nesw-resize; }

.owb-area-ghost {
  position: absolute;
  box-sizing: border-box;
  pointer-events: none;
  border-radius: 8px;
  border: 1.5px dashed var(--orca-color-primary-5, #00a896);
  background: color-mix(in oklab, var(--orca-color-primary-5, #00a896) 10%, transparent);
}

.owb-viewport.is-draw-area {
  cursor: crosshair;
}

.owb-toolbar-btn.is-active {
  background: color-mix(in oklab, var(--orca-color-primary-5, #00a896) 22%, transparent);
  border-color: var(--orca-color-primary-5, #00a896);
}
`.trim();
