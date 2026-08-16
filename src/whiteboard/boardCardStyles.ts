export const BOARD_CARD_CSS = `
.owb-card.is-board {
  background: color-mix(
    in oklab,
    var(--orca-color-primary-5, #00a896) 6%,
    var(--orca-color-bg-1)
  );
  border-color: color-mix(
    in oklab,
    var(--orca-color-primary-5, #00a896) 28%,
    var(--orca-color-border)
  );
}

.owb-card.is-board.is-selected:not(.is-editing):not(.is-dragging):not(.is-resizing) {
  border-color: var(--orca-color-primary-5, #00a896);
}

.owb-card.is-board .owb-card-body,
.owb-viewport[data-mouse-scheme="mouse"] .owb-card.is-board:not(.is-editing) .owb-card-body {
  cursor: default;
  user-select: none;
}

.owb-board-card-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 10px;
}

.owb-board-card-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
}

.owb-board-card-icon {
  flex: 0 0 auto;
  font-size: 18px;
  color: var(--orca-color-text-2);
}

.owb-board-card-name {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--orca-color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owb-board-card-count {
  font-size: 12px;
  font-weight: 400;
  color: var(--orca-color-text-2);
}

.owb-board-card-count.is-error {
  color: var(--orca-color-dangerous-5, #d9381e);
  font-weight: 700;
}

.owb-board-card-open {
  display: inline-flex;
}
`.trim();
