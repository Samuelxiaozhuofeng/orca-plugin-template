export const CARD_CSS = `
.owb-card {
  position: absolute;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  cursor: default;
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

.owb-card:hover:not(.is-dragging):not(.is-resizing) {
  transform: translateY(-1px);
  box-shadow:
    var(--owb-shadow-hover),
    0 0 0 1px var(--orca-color-border);
}

.owb-card.is-dragging {
  z-index: 4;
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

.owb-card.is-editing {
  z-index: 3;
  box-shadow:
    var(--owb-shadow-hover),
    0 0 0 2px var(--orca-color-primary-5);
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

.owb-card-resize {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  opacity: 0;
  transition: opacity var(--owb-duration) var(--owb-ease);
  background:
    linear-gradient(
      135deg,
      transparent 0 52%,
      var(--orca-color-text-3) 52% 58%,
      transparent 58% 72%,
      var(--orca-color-text-3) 72% 78%,
      transparent 78%
    );
}

.owb-card:hover .owb-card-resize {
  opacity: 0.5;
}

.owb-card .owb-card-resize:hover,
.owb-card.is-resizing .owb-card-resize {
  opacity: 1;
}

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
