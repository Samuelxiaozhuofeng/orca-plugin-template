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
  stroke: var(--orca-color-text-2);
  stroke-width: 2;
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
  stroke: var(--orca-color-text-1);
  stroke-width: 2.5;
}

.owb-edge.is-selected .owb-edge-visible {
  stroke: var(--orca-color-primary-5);
  stroke-width: 3;
}

.owb-edge.is-ref .owb-edge-visible {
  stroke: var(--orca-color-text-3);
  stroke-width: 1.5;
  stroke-dasharray: 5 5;
}

.owb-edge-ghost {
  fill: none;
  stroke: var(--orca-color-text-2);
  stroke-width: 2;
  stroke-dasharray: 6 5;
  stroke-linecap: round;
  pointer-events: none;
  vector-effect: non-scaling-stroke;
}

.owb-edge-handle {
  fill: var(--orca-color-bg-1);
  stroke: var(--orca-color-primary-5);
  stroke-width: 1.5;
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
.owb-edge-editor {
  position: absolute;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
  max-width: 220px;
  padding: 1px 6px;
  border-radius: var(--owb-radius-sm);
  border: 1px solid var(--orca-color-border);
  background: var(--orca-color-bg-1);
  color: var(--orca-color-text-1);
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.owb-edge-editor {
  pointer-events: auto;
  min-width: 60px;
  outline: none;
  box-shadow: 0 0 0 1px var(--orca-color-primary-5);
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
  box-shadow: 0 0 0 1.5px var(--orca-color-primary-5);
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
  box-shadow:
    var(--owb-shadow-hover),
    0 0 0 2px var(--orca-color-primary-5),
    0 0 0 6px color-mix(in oklab, var(--orca-color-primary-5) 16%, transparent);
}

.owb-canvas.is-drawing-edge {
  cursor: crosshair;
}
`.trim();
