export const AREA_CSS = `
.owb-area-layer {
  --owb-area-inv: 1;
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.owb-area {
  --owb-area-ink: var(--orca-color-primary-5, #00a896);
  position: absolute;
  box-sizing: border-box;
  pointer-events: auto;
  cursor: grab;
  border: none;
  border-radius: 12px;
  background: color-mix(in oklab, var(--owb-area-ink) 5%, transparent);
  box-shadow: inset 0 0 0 calc(1.25px * var(--owb-area-inv))
    color-mix(in oklab, var(--owb-area-ink) 22%, transparent);
}

.owb-area:hover {
  background: color-mix(in oklab, var(--owb-area-ink) 9%, transparent);
  box-shadow: inset 0 0 0 calc(1.25px * var(--owb-area-inv))
    color-mix(in oklab, var(--owb-area-ink) 48%, transparent);
}

.owb-area.is-selected {
  background: color-mix(in oklab, var(--owb-area-ink) 12%, transparent);
  box-shadow:
    inset 0 0 0 calc(1.5px * var(--owb-area-inv)) var(--owb-area-ink),
    0 0 calc(10px * var(--owb-area-inv))
      color-mix(in oklab, var(--owb-area-ink) 42%, transparent);
}

.owb-area.is-resizing,
.owb-area.is-moving {
  transition: none;
  cursor: grabbing;
}

.owb-area.is-moving .owb-area-title {
  cursor: grabbing;
}

.owb-area-title {
  position: absolute;
  left: 0;
  bottom: 100%;
  max-width: 100%;
  margin: 0 0 6px;
  padding: 2px 8px;
  display: flex;
  align-items: center;
  pointer-events: auto;
  cursor: grab;
  transform: scale(var(--owb-area-inv));
  transform-origin: left bottom;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  color: var(--orca-color-text-2);
  user-select: none;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  border-radius: 6px;
  border: 1px solid color-mix(in oklab, var(--owb-area-ink) 28%, transparent);
  background: color-mix(in oklab, var(--orca-color-bg-1) 82%, transparent);
}

.owb-area.is-selected .owb-area-title {
  color: var(--orca-color-text-1);
  border-color: color-mix(in oklab, var(--owb-area-ink) 55%, transparent);
}

.owb-area-title-input {
  width: 100%;
  min-width: 72px;
  height: 20px;
  margin: 0;
  padding: 0 4px;
  cursor: text;
  border: 1px solid var(--owb-area-ink);
  border-radius: 3px;
  background: var(--orca-color-bg-1);
  color: var(--orca-color-text-1);
  font: inherit;
  outline: none;
}

.owb-area-handle {
  position: absolute;
  width: calc(10px * var(--owb-area-inv));
  height: calc(10px * var(--owb-area-inv));
  box-sizing: border-box;
  pointer-events: auto;
  border: calc(1.5px * var(--owb-area-inv)) solid var(--owb-area-ink);
  background: var(--orca-color-bg-1);
  border-radius: 1px;
  z-index: 1;
}

.owb-area-handle-nw { top: 0; left: 0; transform: translate(-50%, -50%); cursor: nwse-resize; }
.owb-area-handle-ne { top: 0; right: 0; transform: translate(50%, -50%); cursor: nesw-resize; }
.owb-area-handle-se { bottom: 0; right: 0; transform: translate(50%, 50%); cursor: nwse-resize; }
.owb-area-handle-sw { bottom: 0; left: 0; transform: translate(-50%, 50%); cursor: nwse-resize; }

.owb-area-ghost {
  position: absolute;
  box-sizing: border-box;
  pointer-events: none;
  border-radius: 12px;
  border: none;
  background: color-mix(in oklab, var(--orca-color-primary-5, #00a896) 8%, transparent);
  box-shadow: inset 0 0 0 calc(1.5px * var(--owb-area-inv))
    color-mix(in oklab, var(--orca-color-primary-5, #00a896) 55%, transparent);
}

.owb-viewport.is-draw-area {
  cursor: crosshair;
}

.owb-viewport.is-draw-area .owb-area,
.owb-viewport.is-draw-area .owb-area-title {
  cursor: crosshair;
}

.owb-toolbar-btn.is-active {
  background: color-mix(in oklab, var(--orca-color-primary-5, #00a896) 22%, transparent);
  border-color: var(--orca-color-primary-5, #00a896);
}
`.trim();
