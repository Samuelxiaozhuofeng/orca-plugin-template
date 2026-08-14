export const BOARD_TITLE_CSS = `
.owb-toolbar-title {
  appearance: none;
  max-width: 200px;
  margin: 0;
  padding: 2px var(--owb-space-2);
  border: none;
  border-radius: var(--owb-radius-sm);
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--orca-color-text-1);
  cursor: text;
}

.owb-toolbar-title:hover {
  background: var(--orca-color-menu-highlight);
}

.owb-toolbar-title-input {
  box-sizing: border-box;
  width: 160px;
  max-width: 200px;
  margin: 0;
  padding: 2px var(--owb-space-2);
  border: none;
  border-radius: var(--owb-radius-sm);
  background: var(--orca-color-bg-1);
  box-shadow: 0 0 0 1px var(--orca-color-border);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--orca-color-text-1);
}

.owb-toolbar-title-input:disabled {
  opacity: 0.7;
}
`.trim();
