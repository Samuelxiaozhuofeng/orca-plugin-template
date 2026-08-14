export const BOARD_TITLE_CSS = `
.owb-toolbar-title {
  appearance: none;
  max-width: 200px;
  margin: 0;
  padding: 2px var(--owb-space-2);
  border: 1.5px solid transparent;
  border-radius: var(--owb-radius-sm, 3px);
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--orca-color-text-1);
  cursor: text;
  transition: transform var(--owb-duration) var(--owb-ease),
              background var(--owb-duration) var(--owb-ease),
              box-shadow var(--owb-duration) var(--owb-ease);
}

.owb-toolbar-title:hover {
  background: var(--orca-color-warning-5, #f4a259);
  color: #111417;
  border-color: var(--orca-color-border);
  box-shadow: 2px 2px 0px 0px var(--orca-color-border);
}

.owb-toolbar-title-input {
  box-sizing: border-box;
  width: 160px;
  max-width: 200px;
  margin: 0;
  padding: 2px var(--owb-space-2);
  border: 1.5px solid var(--orca-color-border);
  border-radius: var(--owb-radius-sm, 3px);
  background: var(--orca-color-bg-1);
  box-shadow: 2px 2px 0px 0px var(--orca-color-border);
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.4;
  color: var(--orca-color-text-1);
}

.owb-toolbar-title-input:disabled {
  opacity: 0.7;
}
`.trim();
