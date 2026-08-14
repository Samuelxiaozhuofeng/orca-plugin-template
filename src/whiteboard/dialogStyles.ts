export const DIALOG_CSS = `
.owb-dialog {
  width: min(440px, calc(100vw - 48px));
  padding: 20px;
  border-radius: 12px;
  background: var(--orca-color-bg-1);
  box-shadow:
    var(--owb-shadow-hover),
    0 0 0 1px var(--orca-color-border);
}

.owb-dialog-title {
  margin-bottom: var(--owb-space-4);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--orca-color-text-1);
}

.owb-dialog-section {
  display: flex;
  flex-direction: column;
  gap: var(--owb-space-2);
  margin-bottom: var(--owb-space-4);
}

.owb-dialog-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--orca-color-text-2);
}

.owb-preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.owb-preset {
  appearance: none;
  border: none;
  background: var(--orca-color-bg-2);
  color: var(--orca-color-text-1);
  font-size: 12px;
  line-height: 1.3;
  padding: 5px 8px;
  border-radius: var(--owb-radius-btn);
  cursor: pointer;
  transition:
    background var(--owb-duration) var(--owb-ease),
    color var(--owb-duration) var(--owb-ease);
}

.owb-preset:hover:not(:disabled) {
  background: var(--orca-color-menu-highlight);
}

.owb-preset.is-active {
  background: color-mix(in oklab, var(--orca-color-primary-5) 14%, transparent);
  color: var(--orca-color-primary-5);
}

.owb-preset:disabled {
  opacity: 0.45;
  cursor: default;
}

.owb-date-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--owb-space-2);
}

.owb-date-btn {
  appearance: none;
  border: none;
  background: var(--orca-color-bg-2);
  color: var(--orca-color-text-1);
  font-size: 13px;
  line-height: 1.3;
  padding: 6px 10px;
  border-radius: var(--owb-radius-btn);
  box-shadow: 0 0 0 1px var(--orca-color-border);
  cursor: pointer;
  transition:
    background var(--owb-duration) var(--owb-ease),
    box-shadow var(--owb-duration) var(--owb-ease);
}

.owb-date-btn:hover:not(:disabled) {
  background: var(--orca-color-menu-highlight);
}

.owb-date-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.owb-date-sep {
  color: var(--orca-color-text-3);
}

.owb-date-count {
  font-size: 12px;
  color: var(--orca-color-text-3);
}

.owb-dialog-warn {
  font-size: 12px;
  line-height: 1.4;
  color: var(--orca-color-text-red);
}

.owb-dialog-hint {
  font-size: 12px;
  line-height: 1.4;
  color: var(--orca-color-text-3);
}

.owb-columns-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--owb-space-2);
}

.owb-check-row {
  display: flex;
  align-items: center;
  gap: var(--owb-space-2);
  margin: var(--owb-space-2) 0 var(--owb-space-4);
  font-size: 13px;
  color: var(--orca-color-text-1);
  cursor: pointer;
}

.owb-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--owb-space-2);
}
`.trim();
