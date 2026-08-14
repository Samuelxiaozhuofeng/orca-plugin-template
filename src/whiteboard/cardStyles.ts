export const CARD_CSS = `
.owb-viewport[data-mouse-scheme="rightDrag"] .owb-card:not(.is-editing):not(.is-dragging),
.owb-viewport[data-mouse-scheme="rightDrag"] .owb-card:not(.is-editing):not(.is-dragging) .owb-card-title {
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
  border-radius: var(--owb-radius-card);
  box-shadow:
    var(--owb-shadow-rest),
    0 0 0 1px var(--orca-color-border);
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
    var(--owb-shadow-hover),
    0 0 0 1px var(--orca-color-border);
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
    var(--owb-shadow-drag),
    0 0 0 1px var(--orca-color-border);
}

.owb-card.is-resizing {
  z-index: 4;
  transition: none;
}

.owb-card.is-selected:not(.is-editing):not(.is-dragging):not(.is-resizing) {
  z-index: 2;
  box-shadow:
    var(--owb-shadow-hover),
    0 0 0 2px color-mix(in oklab, var(--orca-color-primary-5) 70%, transparent),
    0 0 0 6px color-mix(in oklab, var(--orca-color-primary-5) 16%, transparent);
}

.owb-card.is-marquee-hit:not(.is-selected):not(.is-editing) {
  box-shadow:
    var(--owb-shadow-rest),
    0 0 0 2px color-mix(in oklab, var(--orca-color-primary-5) 45%, transparent);
}

.owb-card.is-editing:not(.is-dragging):not(.is-resizing) {
  z-index: 3;
  box-shadow:
    var(--owb-shadow-hover),
    0 0 0 2px var(--orca-color-primary-5);
}

.owb-card.is-editing .owb-card-body {
  cursor: text;
}

.owb-card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--owb-space-2);
  flex: 0 0 auto;
  height: 32px;
  padding: 0 var(--owb-space-3);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  user-select: none;
  cursor: grab;
  color: var(--orca-color-text-1);
  background: transparent;
  border-bottom: 1px solid var(--orca-color-border-2, var(--orca-color-border));
}

.owb-card.is-dragging .owb-card-title {
  cursor: grabbing;
}

.owb-card-title-main {
  display: flex;
  align-items: center;
  gap: var(--owb-space-2);
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.owb-card-page-icon {
  flex: 0 0 auto;
  color: var(--orca-color-text-2);
}

.owb-card-page {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owb-card-today-dot {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--orca-color-primary-5);
}

.owb-card-date {
  font-size: 13px;
  font-weight: 600;
  color: var(--orca-color-text-1);
}

.owb-card-weekday {
  font-size: 12px;
  font-weight: 400;
  color: var(--orca-color-text-2);
}

.owb-card-weekday.is-weekend {
  color: var(--orca-color-text-red);
}

.owb-card-edit-badge {
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
  color: var(--orca-color-primary-5);
  background: color-mix(in oklab, var(--orca-color-primary-5) 10%, transparent);
}

.owb-card-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: var(--owb-space-3);
  line-height: 1.55;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
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
.owb-card-body .orca-block:first-child {
  margin-top: 0;
}

.owb-card-body > .orca-block:last-child,
.owb-card-body .orca-block:last-child {
  margin-bottom: 0;
}

.owb-card-empty {
  font-size: 12px;
  line-height: 1.55;
  color: var(--orca-color-text-3);
}

.owb-card-excerpt {
  margin: 0;
  line-height: 1.55;
  color: var(--orca-color-text-1);
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 8;
  white-space: pre-wrap;
  word-break: break-word;
}

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

.owb-card-editor,
.owb-card-editor .orca-panel,
.owb-card-editor .orca-hideable,
.owb-card-editor .orca-block-editor,
.owb-card-editor .orca-block-editor-main {
  height: 100%;
  min-height: 0;
}

.owb-card-editor .orca-block-breadcrumb,
.owb-card-editor .orca-scrolling-breadcrumb,
.owb-card-editor .orca-block-editor-cover {
  display: none !important;
}

.owb-card-editor-missing {
  padding: var(--owb-space-2);
  color: var(--orca-color-text-3);
  font-size: 12px;
}
`.trim();
