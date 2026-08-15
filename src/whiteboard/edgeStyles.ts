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

.owb-edge {
  --owb-edge-ink: var(--orca-color-border);
}

.owb-edge.is-linked,
.owb-edge.is-selected,
.owb-edge:hover:not(.is-selected) {
  --owb-edge-ink: var(--orca-color-primary-5, #00a896);
}

.owb-edge-color-blue { --owb-edge-ink: rgb(47, 128, 237); }
.owb-edge-color-green { --owb-edge-ink: rgb(34, 197, 94); }
.owb-edge-color-yellow { --owb-edge-ink: rgb(234, 179, 8); }
.owb-edge-color-coral { --owb-edge-ink: rgb(244, 63, 94); }
.owb-edge-color-purple { --owb-edge-ink: rgb(168, 85, 247); }

.owb-edge.is-ref {
  --owb-edge-ink: var(--orca-color-text-3);
}

.owb-edge-visible {
  fill: none;
  stroke: var(--owb-edge-ink);
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
  stroke-width: 3;
}

.owb-edge.is-linked:not(.is-selected) .owb-edge-visible {
  stroke-width: 2.5;
}

.owb-edge.is-selected .owb-edge-visible {
  stroke-width: 3;
}

.owb-edge.is-ref .owb-edge-visible {
  stroke-width: 1.5;
  stroke-dasharray: 5 5;
  stroke-opacity: 0.55;
}

.owb-edge.is-dashed:not(.is-ref) .owb-edge-visible {
  stroke-dasharray: 10 6;
}

.owb-edge-ghost {
  fill: none;
  stroke: var(--orca-color-border);
  stroke-width: 2.5;
  stroke-dasharray: 6 5;
  stroke-linecap: round;
  pointer-events: none;
  vector-effect: non-scaling-stroke;
  animation: owb-edge-ghost-flow 0.6s linear infinite;
}

@keyframes owb-edge-ghost-flow {
  to { stroke-dashoffset: -11; }
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

.owb-edge-toolbar {
  position: absolute;
  z-index: 36;
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  padding: 6px 8px;
  border-radius: var(--owb-radius-card, 6px);
  border: 1.5px solid var(--orca-color-border);
  background: var(--orca-color-bg-1);
  color: var(--orca-color-text-1);
  box-shadow: 3px 3px 0 0 var(--orca-color-border);
  pointer-events: auto;
}

.owb-edge-toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.owb-edge-toolbar-sep {
  width: 1px;
  height: 16px;
  background: var(--orca-color-border);
}

.owb-edge-toolbar-dot {
  appearance: none;
  width: 16px;
  height: 16px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--orca-color-border);
  background: var(--owb-edge-ink, var(--orca-color-border));
  cursor: pointer;
}

.owb-edge-toolbar-dot.is-default {
  background: var(--orca-color-bg-1);
  background-image: linear-gradient(
    to top right,
    transparent 46%,
    var(--orca-color-text-3) 47%,
    var(--orca-color-text-3) 53%,
    transparent 54%
  );
}

.owb-edge-toolbar-dot:hover {
  transform: scale(1.15);
}

.owb-edge-toolbar-dot.is-active {
  box-shadow: 0 0 0 2px var(--orca-color-primary-5, #00a896);
}

.owb-edge-toolbar-btn {
  appearance: none;
  box-sizing: border-box;
  width: 26px;
  height: 26px;
  padding: 0;
  display: grid;
  place-items: center;
  border: 1.5px solid transparent;
  border-radius: var(--owb-radius-btn, 4px);
  background: transparent;
  color: var(--orca-color-text-1);
  cursor: pointer;
}

.owb-edge-toolbar-btn i {
  font-size: 15px;
  line-height: 1;
}

.owb-edge-toolbar-btn:hover {
  background: var(--orca-color-bg-2);
}

.owb-edge-toolbar-btn.is-active {
  border-color: var(--orca-color-primary-5, #00a896);
  background: color-mix(in oklab, var(--orca-color-primary-5) 16%, transparent);
}
`.trim();
