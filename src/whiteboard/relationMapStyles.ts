export const RELATION_MAP_CSS = `
.owb-relmap {
  position: absolute;
  right: 12px;
  bottom: 64px;
  z-index: 21;
  box-sizing: border-box;
  color: var(--orca-color-text-1);
  background: var(--orca-color-bg-1);
  border: 1px solid var(--orca-color-border);
  animation: owb-relmap-in 160ms ease-out;
}

@keyframes owb-relmap-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.owb-relmap-capsule {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
  appearance: none;
  background: inherit;
  border: 0;
  color: inherit;
  font: inherit;
}

.owb-relmap-capsule i {
  font-size: 14px;
  color: var(--orca-color-primary-5);
}

.owb-relmap-count {
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.owb-relmap-panel {
  width: 280px;
  padding: 10px;
  border-radius: var(--owb-radius-card, 6px);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.owb-relmap-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--orca-color-text-2);
}

.owb-relmap-collapse {
  appearance: none;
  width: 22px;
  height: 22px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--orca-color-border);
  border-radius: var(--owb-radius-btn, 4px);
  background: var(--orca-color-bg-1);
  color: var(--orca-color-text-2);
  cursor: pointer;
}

.owb-relmap-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
}

.owb-relmap-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--orca-color-text-3);
  padding: 0 2px 2px;
}

.owb-relmap-self {
  padding: 6px 8px;
  border-radius: var(--owb-radius-btn, 4px);
  background: color-mix(in oklab, var(--orca-color-primary-5) 18%, var(--orca-color-bg-1));
  color: var(--orca-color-text-1);
  font-size: 12px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owb-relmap-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  padding: 3px 6px;
  border-radius: var(--owb-radius-btn, 4px);
  cursor: pointer;
  border: 1px solid transparent;
}

.owb-relmap-row i {
  flex: 0 0 auto;
  font-size: 13px;
  color: var(--orca-color-text-2);
}

.owb-relmap-row-title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owb-relmap-row.is-on {
  background: var(--orca-color-bg-2);
}

.owb-relmap-row.is-off {
  border-style: dashed;
  border-color: var(--orca-color-primary-5);
  color: var(--orca-color-primary-5);
}

.owb-relmap-row.is-off i {
  color: var(--orca-color-primary-5);
}

.owb-relmap-plus {
  appearance: none;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.owb-relmap-plus i {
  font-size: 13px;
}

.owb-relmap-snippet {
  box-sizing: border-box;
  min-height: 2.7em;
  max-height: 2.7em;
  padding: 4px 2px 0;
  font-size: 11px;
  line-height: 1.35;
  color: var(--orca-color-text-2);
  overflow: hidden;
}

.owb-relmap-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.owb-relmap-stat {
  font-size: 11px;
  color: var(--orca-color-text-2);
  white-space: nowrap;
}

.owb-relmap-add {
  appearance: none;
  padding: 3px 8px;
  border: 1px solid var(--orca-color-border);
  border-radius: var(--owb-radius-btn, 4px);
  background: var(--orca-color-bg-1);
  color: var(--orca-color-text-1);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.owb-relmap-add:disabled {
  opacity: 0.45;
  cursor: default;
}

.owb-relmap-more {
  font-size: 11px;
  color: var(--orca-color-text-3);
}
`.trim();
