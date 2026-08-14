export const CARD_CSS = `
.owb-viewport[data-mouse-scheme="rightDrag"] .owb-card:not(.is-editing):not(.is-dragging) {
  cursor: default;
}

.owb-card {
  position: absolute;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  cursor: grab;
  background: var(--orca-color-bg-1);
  border: none;
  border-radius: 14px;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.04),
    0 8px 24px rgba(0, 0, 0, 0.06),
    0 0 0 1px var(--orca-color-border-2, rgba(0, 0, 0, 0.08));
  transition:
    box-shadow var(--owb-duration) var(--owb-ease),
    transform var(--owb-duration) var(--owb-ease);
}

.owb-card:not(.is-editing) {
  user-select: none;
}

.owb-card:hover:not(.is-dragging):not(.is-resizing):not(.is-selected):not(.is-editing):not(.is-marquee-hit) {
  transform: translateY(-1px);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.06),
    0 12px 32px rgba(0, 0, 0, 0.08),
    0 0 0 1px var(--orca-color-border-2, rgba(0, 0, 0, 0.12));
}

.owb-card.is-selected:hover:not(.is-dragging):not(.is-editing),
.owb-card.is-editing:hover:not(.is-dragging) {
  transform: translateY(-1px);
}

.owb-card.is-dragging {
  z-index: 4;
  cursor: grabbing;
  transform: scale(1.02);
  transition: none;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.12),
    0 20px 48px rgba(0, 0, 0, 0.16),
    0 0 0 1px var(--orca-color-border-2, rgba(0, 0, 0, 0.12));
}

.owb-card.is-resizing {
  z-index: 4;
  transition: none;
}

/* Selected state with Apple Blue border and glow */
.owb-card.is-selected:not(.is-editing):not(.is-dragging):not(.is-resizing) {
  z-index: 2;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.08),
    0 0 0 2.5px var(--orca-color-primary-5, #2F80ED),
    0 0 0 6px color-mix(in oklab, var(--orca-color-primary-5, #2F80ED) 16%, transparent);
}

.owb-card.is-marquee-hit:not(.is-selected):not(.is-editing) {
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.04),
    0 0 0 2px color-mix(in oklab, var(--orca-color-primary-5, #2F80ED) 45%, transparent);
}

/* Editing state */
.owb-card.is-editing:not(.is-dragging):not(.is-resizing) {
  z-index: 3;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.08),
    0 0 0 2.5px var(--orca-color-primary-5, #2F80ED),
    0 0 0 6px color-mix(in oklab, var(--orca-color-primary-5, #2F80ED) 12%, transparent);
}

.owb-card.is-editing .owb-card-body {
  cursor: text;
}

/* Card title & headers */
.owb-card-header {
  display: flex;
  align-items: center;
  gap: var(--owb-space-2);
  padding: 12px 14px 4px 14px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  user-select: none;
  cursor: grab;
  color: var(--orca-color-text-1);
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

/* Minimalist top-left floating weekday badge for journal notes */
.owb-card-journal-badge {
  position: absolute;
  top: 12px;
  left: 14px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  background: color-mix(in oklab, var(--orca-color-text-3) 12%, transparent);
  color: var(--orca-color-text-2);
  user-select: none;
  pointer-events: none;
  transition: background 150ms ease, color 150ms ease;
}

.owb-card-journal-badge.is-weekend {
  color: var(--orca-color-text-red, #E5484D);
  background: color-mix(in oklab, var(--orca-color-text-red, #E5484D) 12%, transparent);
}

.owb-card-journal-badge.is-today {
  color: var(--orca-color-primary-5, #2F80ED);
  background: color-mix(in oklab, var(--orca-color-primary-5, #2F80ED) 12%, transparent);
}

.owb-card-today-dot {
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
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

.owb-card-block-node + .owb-card-block-node {
  margin-top: 2px;
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
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.08),
      0 0 0 2.5px var(--orca-color-primary-5, #2F80ED),
      0 0 0 6px color-mix(in oklab, var(--orca-color-primary-5, #2F80ED) 16%, transparent);
  }
  25%, 75% {
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.08),
      0 0 0 3px var(--orca-color-primary-5, #2F80ED),
      0 0 0 12px color-mix(in oklab, var(--orca-color-primary-5, #2F80ED) 28%, transparent);
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
