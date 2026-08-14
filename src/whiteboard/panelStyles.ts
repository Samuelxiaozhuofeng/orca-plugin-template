export const PANEL_CSS = `
.owb-panel {
  --owb-space-1: 4px;
  --owb-space-2: 8px;
  --owb-space-3: 12px;
  --owb-space-4: 16px;
  --owb-space-5: 24px;
  --owb-radius-card: 12px;
  --owb-radius-btn: 8px;
  --owb-radius-sm: 6px;
  --owb-ease: cubic-bezier(0.25, 0.1, 0.25, 1);
  --owb-duration: 150ms;
  --owb-grid: 24px;
  --owb-shadow-rest: 0 1px 2px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.07);
  --owb-shadow-hover: 0 2px 4px rgba(0, 0, 0, 0.06), 0 8px 20px rgba(0, 0, 0, 0.1);
  --owb-shadow-drag: 0 4px 8px rgba(0, 0, 0, 0.08), 0 16px 32px rgba(0, 0, 0, 0.14);
  --owb-shadow-toolbar: 0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.08);
  --owb-dot-alpha: 8%;
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
    --owb-shadow-rest: 0 1px 2px rgba(0, 0, 0, 0.03), 0 4px 12px rgba(0, 0, 0, 0.04);
    --owb-shadow-hover: 0 2px 4px rgba(0, 0, 0, 0.04), 0 8px 20px rgba(0, 0, 0, 0.06);
    --owb-shadow-drag: 0 4px 8px rgba(0, 0, 0, 0.05), 0 16px 32px rgba(0, 0, 0, 0.08);
    --owb-shadow-toolbar: 0 1px 2px rgba(0, 0, 0, 0.03), 0 8px 24px rgba(0, 0, 0, 0.05);
    --owb-dot-alpha: 5%;
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
  border-radius: 10px;
  background: color-mix(in oklab, var(--orca-color-bg-1) 72%, transparent);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  box-shadow:
    var(--owb-shadow-toolbar),
    0 0 0 1px var(--orca-color-border);
}

.owb-toolbar-sep {
  flex: 0 0 1px;
  align-self: stretch;
  margin: 4px 0;
  background: var(--orca-color-border);
}

.owb-toolbar-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--orca-color-text-1);
  font-size: 13px;
  line-height: 1.3;
  padding: var(--owb-space-1) var(--owb-space-2);
  border-radius: var(--owb-radius-btn);
  cursor: pointer;
}

.owb-toolbar-btn:hover:not(:disabled) {
  background: var(--orca-color-menu-highlight);
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
  border: none;
  background: transparent;
  color: var(--orca-color-text-1);
  font-size: 13px;
  line-height: 1;
  min-width: 28px;
  height: 26px;
  padding: 0 var(--owb-space-2);
  border-radius: var(--owb-radius-sm);
  cursor: pointer;
}

.owb-zoom-btn:hover {
  background: var(--orca-color-menu-highlight);
}

.owb-zoom-sep {
  width: 1px;
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
