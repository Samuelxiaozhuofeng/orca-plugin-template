export const ADD_TO_BOARD_CSS = `
.owb-board-search {
  box-sizing: border-box;
  width: 100%;
  margin-bottom: var(--owb-space-3);
  padding: 7px 10px;
  border: 1.5px solid var(--orca-color-border);
  border-radius: var(--owb-radius-btn, 4px);
  background: var(--orca-color-bg-1);
  box-shadow: inset 1px 1px 0px rgba(0, 0, 0, 0.08);
  color: var(--orca-color-text-1);
  font-size: 13px;
  font-weight: 700;
}

.owb-board-search:focus {
  border-color: var(--orca-color-primary-5, #00a896);
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--orca-color-primary-5, #00a896) 25%, transparent);
  outline: none;
}

.owb-board-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 280px;
  overflow: auto;
}

.owb-board-item {
  appearance: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--owb-space-2);
  width: 100%;
  padding: 8px 10px;
  border: 1.5px solid transparent;
  border-radius: var(--owb-radius-btn, 4px);
  background: transparent;
  color: var(--orca-color-text-1);
  cursor: pointer;
  text-align: left;
  font-weight: 700;
  transition: transform var(--owb-duration) var(--owb-ease),
              background var(--owb-duration) var(--owb-ease),
              box-shadow var(--owb-duration) var(--owb-ease);
}

.owb-board-item:hover:not(:disabled) {
  background: var(--orca-color-warning-5, #f4a259);
  color: #111417;
  border-color: var(--orca-color-border);
  box-shadow: 2px 2px 0px 0px var(--orca-color-border);
  transform: translate(-1px, -1px);
}

.owb-board-item:active:not(:disabled) {
  transform: translate(1px, 1px);
  box-shadow: none;
}

.owb-board-item:disabled {
  opacity: 0.45;
  cursor: default;
}

.owb-board-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owb-board-item-count {
  flex: none;
  font-size: 12px;
  color: var(--orca-color-text-2);
}
`.trim();
