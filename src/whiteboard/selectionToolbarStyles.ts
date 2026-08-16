/** Floating multi-select bar: arrange popover and icon buttons. */
export const SELECTION_TOOLBAR_CSS = `
.owb-selection-icon {
  appearance: none;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--orca-color-text-1, #1a1a1a);
  border-radius: 6px;
  box-shadow: 1.5px 1.5px 0 0 color-mix(in srgb, var(--orca-color-text-1, #1a1a1a) 80%, transparent);
  background: color-mix(in srgb, var(--orca-color-bg-2, #f5f5f7) 70%, var(--orca-color-bg-1, #fff));
  color: var(--orca-color-text-1, #1a1a1a);
  cursor: pointer;
  transition: all 0.12s ease;
}

.owb-selection-icon:hover,
.owb-selection-icon.is-open {
  background: color-mix(in srgb, var(--orca-color-primary-5, #2F80ED) 10%, var(--orca-color-bg-1, #fff));
  border-color: var(--orca-color-primary-5, #2F80ED);
  color: var(--orca-color-primary-5, #2F80ED);
  box-shadow: 2px 2px 0 0 var(--orca-color-primary-5, #2F80ED);
}

.owb-selection-icon:active {
  transform: translate(1.5px, 1.5px);
  box-shadow: 0 0 0 0 transparent;
}

.owb-align-wrap {
  position: relative;
  display: inline-flex;
}

.owb-align-pop {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  z-index: 24;
  padding: 6px;
  border: 1px solid var(--orca-color-text-1, #1a1a1a);
  border-radius: 6px;
  box-shadow: 1.5px 1.5px 0 0 color-mix(in srgb, var(--orca-color-text-1, #1a1a1a) 80%, transparent);
  background: var(--orca-color-bg-1, #fff);
}

.owb-align-grid {
  display: grid;
  grid-template-columns: repeat(3, 28px);
  gap: 4px;
}

.owb-align-cell {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--orca-color-text-1, #1a1a1a);
  border-radius: 6px;
  box-shadow: 1.5px 1.5px 0 0 color-mix(in srgb, var(--orca-color-text-1, #1a1a1a) 80%, transparent);
  background: color-mix(in srgb, var(--orca-color-bg-2, #f5f5f7) 70%, var(--orca-color-bg-1, #fff));
  color: var(--orca-color-text-1, #1a1a1a);
  cursor: pointer;
  transition: all 0.12s ease;
}

.owb-align-cell:hover:not(:disabled) {
  background: color-mix(in srgb, var(--orca-color-primary-5, #2F80ED) 10%, var(--orca-color-bg-1, #fff));
  border-color: var(--orca-color-primary-5, #2F80ED);
  color: var(--orca-color-primary-5, #2F80ED);
  box-shadow: 2px 2px 0 0 var(--orca-color-primary-5, #2F80ED);
}

.owb-align-cell:active:not(:disabled) {
  transform: translate(1.5px, 1.5px);
  box-shadow: 0 0 0 0 transparent;
}

.owb-align-cell:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  box-shadow: none;
}
`.trim();
