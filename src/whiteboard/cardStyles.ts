export const CARD_CSS = `
.owb-viewport[data-mouse-scheme="mouse"] .owb-card:not(.is-editing):not(.is-dragging) {
  cursor: default;
  user-select: auto;
}

.owb-viewport[data-mouse-scheme="mouse"] .owb-card:not(.is-editing) .owb-card-body {
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
}

.owb-card {
  position: absolute;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  cursor: grab;
  background: var(--orca-color-bg-1);
  border: 2px solid var(--orca-color-border);
  border-radius: var(--owb-radius-card, 6px);
  transition:
    transform var(--owb-duration) var(--owb-ease),
    border-color var(--owb-duration) var(--owb-ease);
}

.owb-card:not(.is-editing) {
  user-select: none;
}

.owb-card.is-dragging {
  z-index: 4;
  cursor: grabbing;
  transform: translate(-3px, -3px) scale(1.01);
  transition: none;
}

.owb-card.is-resizing {
  z-index: 4;
  transition: none;
}

/* Selected state with Bamboo Jade border */
.owb-card.is-selected:not(.is-editing):not(.is-dragging):not(.is-resizing) {
  z-index: 2;
  border-color: var(--orca-color-primary-5, #00a896);
}

.owb-card.is-marquee-hit:not(.is-selected):not(.is-editing) {
  border-color: color-mix(in oklab, var(--orca-color-primary-5, #00a896) 60%, transparent);
}

/* Editing state with Imperial Amber border */
.owb-card.is-editing:not(.is-dragging):not(.is-resizing) {
  z-index: 3;
  border-color: var(--orca-color-warning-5, #f4a259);
}

.owb-card.is-editing .owb-card-body {
  cursor: text;
}

/* Card title & headers */
.owb-card-header {
  display: flex;
  align-items: center;
  gap: var(--owb-space-2);
  padding: 10px 14px 6px 14px;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.4;
  user-select: none;
  cursor: grab;
  color: var(--orca-color-text-1);
  border-bottom: 1.5px solid color-mix(in srgb, var(--orca-color-border) 15%, transparent);
  transition: padding-right var(--owb-duration) var(--owb-ease);
}

/* Keep the floating toolbar from sitting on top of the title text. */
.owb-card:hover .owb-card-header,
.owb-card.is-selected .owb-card-header,
.owb-card.is-editing .owb-card-header {
  padding-right: 100px;
}

.owb-card-title-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.owb-card-page-icon {
  flex: 0 0 auto;
  font-size: 15px;
  color: var(--orca-color-text-2);
}

.owb-card-page {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Stamped seal specific journal badge (朱印闲章风格) */
.owb-card-journal-badge {
  position: absolute;
  top: 10px;
  left: 12px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: var(--owb-radius-sm, 3px);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.04em;
  background: linear-gradient(135deg, #d9381e 0%, #b82810 100%);
  color: #fffdf0;
  border: 1.5px solid var(--orca-color-border);
  box-shadow: 2px 2px 0px 0px #701305;
  user-select: none;
  pointer-events: auto;
  cursor: grab;
  transition: background var(--owb-duration) var(--owb-ease),
              box-shadow var(--owb-duration) var(--owb-ease);
}

@media (prefers-color-scheme: dark) {
  .owb-card-journal-badge {
    background: linear-gradient(135deg, #ff4d4d 0%, #d9381e 100%);
    color: #111417;
    box-shadow: 2px 2px 0px 0px #8f2415;
  }
}

.owb-card-journal-badge.is-weekend {
  background: linear-gradient(135deg, #b71c1c 0%, #7f0000 100%);
}

.owb-card-journal-badge.is-today {
  border-color: var(--orca-color-warning-5, #f4a259);
}

.owb-card-today-dot {
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--orca-color-warning-5, #ffb703);
}

.owb-card-badge-weekday {
  line-height: 1.3;
}

/* Card Body & Content Container */
.owb-card-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.6;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

/* Locked-height + editing: keep the body as the card scroller so the
   hosted editor cannot grow past the user-set height. */
.owb-card.is-editing .owb-card-body {
  overflow: auto;
  min-height: 0;
}

.owb-card.is-editing .owb-card-editor {
  max-height: 100%;
  min-height: 0;
}

.owb-card:has(.owb-card-journal-badge) .owb-card-body {
  padding-top: 36px;
}

.owb-card:hover .owb-card-body {
  scrollbar-color: color-mix(in oklab, var(--orca-color-text-3) 30%, transparent) transparent;
}

.owb-card-body::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.owb-card-body::-webkit-scrollbar-track {
  background: transparent;
}

.owb-card-body::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 6px;
}

.owb-card:hover .owb-card-body::-webkit-scrollbar-thumb {
  background: color-mix(in oklab, var(--orca-color-text-3) 30%, transparent);
}

.owb-card-body::-webkit-scrollbar-button {
  display: none;
  width: 0;
  height: 0;
}

.owb-card-body > .orca-block:first-child,
.owb-card-body .orca-block:first-child,
.owb-card-body .owb-card-block-tree > .owb-card-block-node:first-child > .orca-block {
  margin-top: 0;
}

/* Read-only cards always expand children; hide the host fold caret
   so clicking the card cannot write the note fold flag. */
.owb-card:not(.is-editing) .orca-block-folding-handle {
  display: none !important;
}

.owb-card-block-tree {
  min-width: 0;
}

.owb-card-block-node {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}

.owb-card-block-node + .owb-card-block-node {
  margin-top: 2px;
}

.owb-card-block-node > .orca-block {
  flex: 1 1 auto;
  min-width: 0;
}

.owb-card-ref-row {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  border-radius: 3px;
}

.owb-card-ref-row:hover {
  background: color-mix(in oklab, var(--orca-color-primary-5, #00a896) 12%, transparent);
}

/* Stamped cinnabar ink-drop extract bullet */
.owb-extract-bullet {
  flex: 0 0 7px;
  width: 7px;
  height: 7px;
  min-width: 7px;
  min-height: 7px;
  margin-top: 0.55em;
  margin-right: 2px;
  border: 1px solid var(--orca-color-border);
  border-radius: 50%;
  background: var(--orca-color-dangerous-5, #d9381e);
  cursor: grab;
  user-select: none;
  display: inline-block;
  transition: transform var(--owb-duration) var(--owb-ease),
              background var(--owb-duration) var(--owb-ease);
}

.owb-extract-bullet.is-root {
  opacity: 0.35;
  cursor: default;
  pointer-events: none;
  background: var(--orca-color-text-2, #666);
}

.owb-extract-bullet:not(.is-root):hover {
  background: var(--orca-color-primary-5, #00a896);
  transform: scale(1.4);
}

.owb-extract-bullet:active {
  cursor: grabbing;
}

.owb-card-body > .orca-block:last-child,
.owb-card-body .orca-block:last-child {
  margin-bottom: 0;
}

.owb-card-empty {
  font-size: 13px;
  line-height: 1.55;
  color: var(--orca-color-text-3);
  font-style: italic;
}

.owb-card-load-error {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 10px 12px;
  border: 1px dashed color-mix(in oklab, var(--orca-color-dangerous-5, #d9381e) 50%, var(--orca-color-border));
  border-radius: var(--owb-radius-sm, 3px);
  background: color-mix(in oklab, var(--orca-color-dangerous-5, #d9381e) 8%, transparent);
  color: var(--orca-color-text-2);
  font: inherit;
  font-size: 13px;
  line-height: 1.45;
  text-align: center;
  cursor: pointer;
}

.owb-card-load-error.is-fill {
  min-height: 3.6em;
}

.owb-card-load-error.is-banner {
  margin-top: 10px;
  min-height: 0;
  justify-content: flex-start;
  text-align: left;
}

.owb-card-load-error.is-static,
.owb-card-load-error.is-busy {
  cursor: default;
}

.owb-card-load-error.is-busy {
  opacity: 0.85;
  pointer-events: none;
}

.owb-card-load-error:not(.is-static):not(.is-busy):hover {
  background: color-mix(in oklab, var(--orca-color-dangerous-5, #d9381e) 14%, transparent);
  color: var(--orca-color-text-1);
}

.owb-card.is-simplified {
  justify-content: center;
}

.owb-card.is-simplified .owb-card-header {
  flex: 1 1 auto;
  min-height: 0;
  align-items: center;
  border-bottom: none;
}

.owb-card.is-simplified .owb-card-journal-badge {
  position: static;
  margin: 10px 12px;
}

.owb-card-excerpt {
  margin: 0;
  line-height: 1.6;
  color: var(--orca-color-text-1);
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 8;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Card Resize Handles */
.owb-card-handle {
  position: absolute;
  z-index: 5;
  box-sizing: border-box;
  background: transparent;
  border: none;
  box-shadow: none;
  pointer-events: auto;
}

.owb-card-handle-n,
.owb-card-handle-s {
  left: 12px;
  right: 12px;
  height: 8px;
  cursor: ns-resize;
}

.owb-card-handle-e,
.owb-card-handle-w {
  top: 12px;
  bottom: 12px;
  width: 8px;
  cursor: ew-resize;
}

.owb-card-handle-n { top: 0; }
.owb-card-handle-s { bottom: 0; }
.owb-card-handle-e { right: 0; }
.owb-card-handle-w { left: 0; }

.owb-card-handle-ne,
.owb-card-handle-nw,
.owb-card-handle-se,
.owb-card-handle-sw {
  width: 12px;
  height: 12px;
}

.owb-card-handle-ne { top: 0; right: 0; cursor: nesw-resize; }
.owb-card-handle-nw { top: 0; left: 0; cursor: nwse-resize; }
.owb-card-handle-se { bottom: 0; right: 0; cursor: nwse-resize; }
.owb-card-handle-sw { bottom: 0; left: 0; cursor: nesw-resize; }

@keyframes owb-card-focus-flash {
  0%, 50%, 100% {
    border-color: var(--orca-color-primary-5, #00a896);
  }
  25%, 75% {
    border-color: var(--orca-color-warning-5, #f4a259);
  }
}

.owb-card.is-focus-flash {
  z-index: 6;
  animation: owb-card-focus-flash 1200ms ease-in-out;
}

.owb-canvas.is-view-animating {
  transition: transform 240ms ease-out;
}

.owb-grid.is-view-animating {
  transition:
    background-position 240ms ease-out,
    background-size 240ms ease-out;
}
`.trim();
