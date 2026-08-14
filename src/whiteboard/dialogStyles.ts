export const DIALOG_CSS = `
.owb-dialog {
  width: min(440px, calc(100vw - 48px));
  padding: 20px;
  border-radius: var(--owb-radius-card, 6px);
  background: var(--orca-color-bg-1);
  border: 2px solid var(--orca-color-border);
  box-shadow: 4px 4px 0px 0px var(--orca-color-border);
}

.owb-dialog-title {
  margin-bottom: var(--owb-space-4);
  font-size: 15px;
  font-weight: 800;
  line-height: 1.4;
  color: var(--orca-color-text-1);
  border-bottom: 1.5px solid color-mix(in srgb, var(--orca-color-border) 20%, transparent);
  padding-bottom: 8px;
}

.owb-dialog-section {
  display: flex;
  flex-direction: column;
  gap: var(--owb-space-2);
  margin-bottom: var(--owb-space-4);
}

.owb-dialog-label {
  font-size: 12px;
  font-weight: 800;
  color: var(--orca-color-text-1);
}

.owb-preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.owb-preset {
  appearance: none;
  border: 1.5px solid var(--orca-color-border);
  background: var(--orca-color-bg-1);
  color: var(--orca-color-text-1);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
  padding: 5px 8px;
  border-radius: var(--owb-radius-btn, 4px);
  box-shadow: 1.5px 1.5px 0px 0px var(--orca-color-border);
  cursor: pointer;
  transition: transform var(--owb-duration) var(--owb-ease),
              background var(--owb-duration) var(--owb-ease),
              color var(--owb-duration) var(--owb-ease),
              box-shadow var(--owb-duration) var(--owb-ease);
}

.owb-preset:hover:not(:disabled) {
  background: var(--orca-color-warning-5, #f4a259);
  color: #111417;
  transform: translate(-1px, -1px);
  box-shadow: 2.5px 2.5px 0px 0px var(--orca-color-border);
}

.owb-preset.is-active {
  background: var(--orca-color-primary-5, #00a896);
  color: #111417;
  transform: none;
  box-shadow: inset 1.5px 1.5px 0px rgba(0, 0, 0, 0.25);
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
  border: 1.5px solid var(--orca-color-border);
  background: var(--orca-color-bg-1);
  color: var(--orca-color-text-1);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
  padding: 6px 10px;
  border-radius: var(--owb-radius-btn, 4px);
  box-shadow: 1.5px 1.5px 0px 0px var(--orca-color-border);
  cursor: pointer;
  transition: transform var(--owb-duration) var(--owb-ease),
              background var(--owb-duration) var(--owb-ease),
              box-shadow var(--owb-duration) var(--owb-ease);
}

.owb-date-btn:hover:not(:disabled) {
  background: var(--orca-color-warning-5, #f4a259);
  color: #111417;
  transform: translate(-1px, -1px);
  box-shadow: 2.5px 2.5px 0px 0px var(--orca-color-border);
}

.owb-date-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.owb-date-sep {
  color: var(--orca-color-text-3);
  font-weight: 700;
}

.owb-date-count {
  font-size: 12px;
  font-weight: 700;
  color: var(--orca-color-text-2);
}

.owb-dialog-warn {
  font-size: 12px;
  line-height: 1.4;
  color: var(--orca-color-text-red);
  font-weight: 700;
}

.owb-dialog-hint {
  font-size: 12px;
  line-height: 1.4;
  color: var(--orca-color-text-2);
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
  font-weight: 700;
  color: var(--orca-color-text-1);
  cursor: pointer;
}

.owb-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--owb-space-2);
}
`.trim();
