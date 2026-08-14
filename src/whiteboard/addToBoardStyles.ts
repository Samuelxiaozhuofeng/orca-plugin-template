export const ADD_TO_BOARD_CSS = `
.owb-board-search {
  box-sizing: border-box;
  width: 100%;
  margin-bottom: var(--owb-space-3);
  padding: 7px 10px;
  border: none;
  border-radius: var(--owb-radius-btn);
  background: var(--orca-color-bg-2);
  box-shadow: 0 0 0 1px var(--orca-color-border);
  color: var(--orca-color-text-1);
  font-size: 13px;
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
  border: none;
  border-radius: var(--owb-radius-btn);
  background: transparent;
  color: var(--orca-color-text-1);
  cursor: pointer;
  text-align: left;
}

.owb-board-item:hover:not(:disabled) {
  background: var(--orca-color-menu-highlight);
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
  color: var(--orca-color-text-3);
}
`.trim();
