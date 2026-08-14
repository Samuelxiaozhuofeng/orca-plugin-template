export const WHITEBOARD_CSS_ROLE = "whiteboard.canvas.styles";

export const WHITEBOARD_CSS = `
.owb-block-card {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  line-height: 1.4;
}

.owb-block-title {
  font-weight: 600;
  color: var(--orca-color-text-1, #222);
}

.owb-block-count {
  font-size: 12px;
  color: var(--orca-color-text-2, #777);
}

.owb-block-card .orca-button {
  margin-left: auto;
}

.owb-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
  background: var(--orca-color-bg-2, #f4f4f4);
}

.owb-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  min-height: 40px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--orca-color-border, #c8c8c8);
  background: var(--orca-color-bg-1, #fff);
}

.owb-toolbar-title {
  font-weight: 600;
  margin-right: auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--orca-color-text-1, #222);
}

.owb-toolbar-scale {
  font-size: 12px;
  min-width: 3.5em;
  text-align: right;
  color: var(--orca-color-text-2, #777);
}

.owb-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--orca-color-text-2, #777);
}

.owb-viewport {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
}

.owb-viewport.is-panning {
  cursor: grabbing;
}

.owb-canvas-empty {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  text-align: center;
  pointer-events: none;
  font-size: 13px;
  opacity: 0.55;
}

.owb-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: 0 0;
}

.owb-card {
  position: absolute;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  cursor: default;
  background: var(--orca-color-bg-1, #fff);
  border: 1px solid var(--orca-color-border, #c8c8c8);
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.owb-card.is-dragging {
  z-index: 2;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}

.owb-card-title {
  flex: 0 0 auto;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  user-select: none;
  cursor: grab;
  color: var(--orca-color-text-1, #222);
  background: var(--orca-color-bg-2, #f4f4f4);
  border-bottom: 1px solid var(--orca-color-border, #c8c8c8);
}

.owb-card.is-dragging .owb-card-title {
  cursor: grabbing;
}

.owb-card-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 4px 6px 8px;
}

.owb-card.is-editing,
.owb-card.is-resizing {
  z-index: 3;
}

.owb-card.is-editing {
  outline: 2px solid var(--orca-color-primary-5, #3b82f6);
}

.owb-card-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
  background:
    linear-gradient(
      135deg,
      transparent 0 46%,
      var(--orca-color-text-2, #888) 46% 54%,
      transparent 54% 70%,
      var(--orca-color-text-2, #888) 70% 78%,
      transparent 78%
    );
  opacity: 0.35;
}

.owb-card:hover .owb-card-resize,
.owb-card.is-resizing .owb-card-resize {
  opacity: 0.9;
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
  padding: 8px;
  color: var(--orca-color-text-2, #777);
  font-size: 12px;
}
`.trim();

export function injectWhiteboardStyles(): void {
  orca.themes.injectCSS(WHITEBOARD_CSS, WHITEBOARD_CSS_ROLE);
}

export function removeWhiteboardStyles(): void {
  orca.themes.removeCSS(WHITEBOARD_CSS_ROLE);
}
