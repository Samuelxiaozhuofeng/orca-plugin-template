export const EDGE_CSS = `
.owb-edge-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.owb-edges {
  position: absolute;
  left: 0;
  top: 0;
  width: 1px;
  height: 1px;
  overflow: visible;
  pointer-events: none;
  z-index: 0;
}

.owb-edge-visible {
  fill: none;
  stroke: var(--orca-color-border);
  stroke-width: 2.5;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.owb-edge-hit {
  fill: none;
  stroke: transparent;
  stroke-width: 16;
  stroke-linecap: round;
  pointer-events: stroke;
  vector-effect: non-scaling-stroke;
}

.owb-edge:hover .owb-edge-hit {
  cursor: pointer;
}

.owb-edge:hover:not(.is-selected) .owb-edge-visible {
  stroke: var(--orca-color-primary-5, #00a896);
  stroke-width: 3;
}

.owb-edge.is-linked:not(.is-selected) .owb-edge-visible {
  stroke: var(--orca-color-primary-5, #00a896);
  stroke-width: 2.5;
}

.owb-edge.is-selected .owb-edge-visible {
  stroke: var(--orca-color-primary-5, #00a896);
  stroke-width: 3;
}

.owb-edge.is-ref .owb-edge-visible {
  stroke: var(--orca-color-text-3);
  stroke-width: 1.5;
  stroke-dasharray: 5 5;
}

.owb-edge-ghost {
  fill: none;
  stroke: var(--orca-color-border);
  stroke-width: 2.5;
  stroke-dasharray: 6 5;
  stroke-linecap: round;
  pointer-events: none;
  vector-effect: non-scaling-stroke;
}

.owb-edge-handle {
  fill: var(--orca-color-bg-1);
  stroke: var(--orca-color-primary-5, #00a896);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.owb-edge.is-selected .owb-edge-handle {
  pointer-events: auto;
  cursor: grab;
}

.owb-edge.is-selected .owb-edge-handle:active {
  cursor: grabbing;
}

.owb-edge-handle-mid {
  fill: var(--orca-color-primary-5, #00a896);
}

.owb-edge-tangent {
  fill: none;
  stroke: var(--orca-color-primary-5, #00a896);
  stroke-width: 1.25;
  stroke-dasharray: 4 3;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.owb-edge-snap {
  fill: var(--orca-color-primary-5, #00a896);
  fill-opacity: 0.18;
  stroke: var(--orca-color-primary-5, #00a896);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.owb-edge-labels {
  position: absolute;
  inset: 0;
  overflow: visible;
  pointer-events: none;
  z-index: 1;
}

.owb-edge-label,
.owb-edge-editor,
.owb-edge-link-badge {
  position: absolute;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
  max-width: 220px;
  padding: 2px 7px;
  border-radius: var(--owb-radius-sm, 3px);
  border: 1.5px solid var(--orca-color-border);
  background: var(--orca-color-bg-1);
  color: var(--orca-color-text-1);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 2px 2px 0px 0px var(--orca-color-border);
}

.owb-edge-label,
.owb-edge-link-badge {
  display: flex;
  align-items: center;
  gap: 4px;
}

.owb-edge-link-badge {
  padding: 2px 6px;
}

.owb-edge-link-icon {
  font-size: 12px;
  line-height: 1;
  color: var(--orca-color-primary-5, #00a896);
}

.owb-edge-editor {
  pointer-events: auto;
  min-width: 60px;
  outline: none;
  border-color: var(--orca-color-primary-5, #00a896);
  box-shadow: 2px 2px 0px 0px var(--orca-color-border);
}

.owb-card-anchors {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
}

.owb-card-anchor {
  position: absolute;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border-radius: 50%;
  box-sizing: border-box;
  background: var(--orca-color-bg-1);
  box-shadow: 0 0 0 1.5px var(--orca-color-primary-5, #00a896);
  opacity: 0;
  pointer-events: none;
  cursor: crosshair;
  transition: opacity var(--owb-duration) var(--owb-ease);
}

.owb-card:hover:not(.is-editing):not(.is-dragging):not(.is-resizing) .owb-card-anchor {
  opacity: 1;
  pointer-events: auto;
}

.owb-card.is-editing .owb-card-anchors {
  display: none;
}

.owb-card-anchor-t { top: 0; left: 50%; }
.owb-card-anchor-r { top: 50%; left: 100%; }
.owb-card-anchor-b { top: 100%; left: 50%; }
.owb-card-anchor-l { top: 50%; left: 0; }

.owb-card.is-edge-target:not(.is-editing) {
  border-color: var(--orca-color-primary-5, #00a896);
  box-shadow: 4px 4px 0px 0px var(--orca-color-primary-5, #00a896);
}

.owb-canvas.is-drawing-edge,
.owb-canvas.is-rebinding-edge {
  cursor: crosshair;
}

.owb-canvas.is-editing-edge {
  cursor: grabbing;
}
`.trim();
