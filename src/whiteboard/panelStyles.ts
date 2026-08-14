export const PANEL_CSS = `
.owb-panel {
  --owb-space-1: 4px;
  --owb-space-2: 8px;
  --owb-space-3: 12px;
  --owb-space-4: 16px;
  --owb-space-5: 24px;
  --owb-radius-card: 6px;
  --owb-radius-btn: 4px;
  --owb-radius-sm: 3px;
  --owb-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --owb-duration: 120ms;
  --owb-grid: 24px;
  --owb-shadow-rest: 3px 3px 0px 0px var(--orca-color-border);
  --owb-shadow-hover: 5px 5px 0px 0px var(--orca-color-border);
  --owb-shadow-drag: 6px 6px 0px 0px var(--orca-color-border);
  --owb-shadow-toolbar: 3px 3px 0px 0px var(--orca-color-border);
  --owb-dot-alpha: 14%;
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
  background: var(--orca-color-bg-2);
}

@media (prefers-color-scheme: dark) {
  .owb-panel {
    --owb-shadow-rest: 3px 3px 0px 0px var(--orca-color-border);
    --owb-shadow-hover: 5px 5px 0px 0px var(--orca-color-border);
    --owb-shadow-drag: 6px 6px 0px 0px var(--orca-color-border);
    --owb-shadow-toolbar: 3px 3px 0px 0px var(--orca-color-border);
    --owb-dot-alpha: 10%;
  }
}

.owb-toolbar {
  position: absolute;
  top: var(--owb-space-4);
  left: var(--owb-space-4);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: var(--owb-space-2);
  max-width: calc(100% - 32px);
  padding: var(--owb-space-1) var(--owb-space-2);
  border-radius: var(--owb-radius-card);
  background: var(--orca-color-bg-1);
  border: 2px solid var(--orca-color-border);
  box-shadow: var(--owb-shadow-toolbar);
}

.owb-toolbar-sep {
  flex: 0 0 1.5px;
  align-self: stretch;
  margin: 4px 0;
  background: var(--orca-color-border);
}

.owb-toolbar-btn {
  appearance: none;
  border: 1.5px solid transparent;
  background: transparent;
  color: var(--orca-color-text-1);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
  padding: var(--owb-space-1) var(--owb-space-2);
  border-radius: var(--owb-radius-btn);
  cursor: pointer;
  transition: transform var(--owb-duration) var(--owb-ease),
              background var(--owb-duration) var(--owb-ease),
              color var(--owb-duration) var(--owb-ease),
              box-shadow var(--owb-duration) var(--owb-ease);
}

.owb-toolbar-btn:hover:not(:disabled) {
  background: var(--orca-color-warning-5, #f4a259);
  color: #111417;
  border-color: var(--orca-color-border);
  box-shadow: 2px 2px 0px 0px var(--orca-color-border);
  transform: translate(-1px, -1px);
}

.owb-toolbar-btn:active:not(:disabled) {
  transform: translate(1px, 1px);
  box-shadow: none;
}

.owb-toolbar-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.owb-zoom {
  display: flex;
  align-items: center;
}

.owb-zoom-btn {
  appearance: none;
  border: 1.5px solid transparent;
  background: transparent;
  color: var(--orca-color-text-1);
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  min-width: 28px;
  height: 26px;
  padding: 0 var(--owb-space-2);
  border-radius: var(--owb-radius-sm);
  cursor: pointer;
  transition: transform var(--owb-duration) var(--owb-ease),
              background var(--owb-duration) var(--owb-ease),
              color var(--owb-duration) var(--owb-ease),
              box-shadow var(--owb-duration) var(--owb-ease);
}

.owb-zoom-btn:hover {
  background: var(--orca-color-warning-5, #f4a259);
  color: #111417;
  border-color: var(--orca-color-border);
  box-shadow: 2px 2px 0px 0px var(--orca-color-border);
  transform: translate(-1px, -1px);
}

.owb-zoom-btn:active {
  transform: translate(1px, 1px);
  box-shadow: none;
}

.owb-zoom-sep {
  width: 1.5px;
  height: 14px;
  background: var(--orca-color-border);
}

.owb-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--orca-color-text-3);
}
`.trim();
