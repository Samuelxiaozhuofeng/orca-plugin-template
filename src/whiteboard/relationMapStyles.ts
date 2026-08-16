export const RELATION_MAP_CSS = `
.owb-relmap {
  position: absolute;
  right: 16px;
  bottom: 64px;
  z-index: 21;
  box-sizing: border-box;
  color: var(--orca-color-text-1);
  font-family: inherit;
  animation: owb-relmap-in 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes owb-relmap-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Floating Collapsed Capsule */
.owb-relmap-capsule {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 10px;
  border-radius: 999px;
  cursor: pointer;
  appearance: none;
  background: var(--orca-color-bg-1);
  border: 1.5px solid var(--orca-color-border);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 2px 2px 0px 0px var(--orca-color-border);
  color: var(--orca-color-text-1);
  font: inherit;
  transition: transform var(--owb-duration) var(--owb-ease),
              box-shadow var(--owb-duration) var(--owb-ease),
              border-color var(--owb-duration) var(--owb-ease);
}

.owb-relmap-capsule:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12), 2px 3px 0px 0px var(--orca-color-border);
  border-color: var(--orca-color-primary-5);
}

.owb-relmap-capsule:active {
  transform: translateY(1px);
  box-shadow: 1px 1px 0px 0px var(--orca-color-border);
}

.owb-relmap-capsule i {
  font-size: 15px;
  color: var(--orca-color-primary-5);
}

.owb-relmap-capsule-label {
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.owb-relmap-capsule-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 5px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  background: var(--orca-color-primary-5);
  color: #ffffff;
}

/* Expanded Panel */
.owb-relmap-panel {
  width: 320px;
  max-height: 520px;
  padding: 12px;
  border-radius: var(--owb-radius-card, 8px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--orca-color-bg-1);
  border: 1.5px solid var(--orca-color-border);
  box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.16), 2px 2px 0px 0px var(--orca-color-border);
}

/* Header */
.owb-relmap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 2px;
}

.owb-relmap-header-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.owb-relmap-header-icon {
  font-size: 16px;
  color: var(--orca-color-primary-5);
}

.owb-relmap-header-text {
  font-size: 13px;
  font-weight: 700;
  color: var(--orca-color-text-1);
}

.owb-relmap-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.owb-relmap-add-all-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid var(--orca-color-border);
  border-radius: var(--owb-radius-sm, 3px);
  background: var(--orca-color-bg-2);
  color: var(--orca-color-text-1);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--owb-duration) var(--owb-ease);
}

.owb-relmap-add-all-btn:hover:not(:disabled) {
  background: var(--orca-color-primary-5);
  color: #ffffff;
  border-color: var(--orca-color-primary-5);
}

.owb-relmap-add-all-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.owb-relmap-close-btn {
  appearance: none;
  width: 22px;
  height: 22px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: var(--owb-radius-sm, 3px);
  background: transparent;
  color: var(--orca-color-text-2);
  cursor: pointer;
  transition: all var(--owb-duration) var(--owb-ease);
}

.owb-relmap-close-btn:hover {
  background: var(--orca-color-bg-2);
  color: var(--orca-color-text-1);
  border-color: var(--orca-color-border);
}

/* Current Card Banner */
.owb-relmap-current-card {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: var(--owb-radius-sm, 4px);
  background: var(--orca-color-bg-2);
  border: 1px solid var(--orca-color-border);
  font-size: 12px;
}

.owb-relmap-current-tag {
  flex: 0 0 auto;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  background: color-mix(in oklab, var(--orca-color-primary-5) 20%, var(--orca-color-bg-1));
  color: var(--orca-color-primary-5);
  line-height: 1.2;
}

.owb-relmap-current-title {
  flex: 1 1 auto;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--orca-color-text-1);
}

/* Segmented Control Tabs */
.owb-relmap-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--orca-color-bg-2);
  border-radius: var(--owb-radius-sm, 4px);
}

.owb-relmap-tab {
  flex: 1 1 0;
  min-width: 0;
  appearance: none;
  border: 0;
  background: transparent;
  padding: 4px 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--orca-color-text-2);
  border-radius: var(--owb-radius-sm, 3px);
  cursor: pointer;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all var(--owb-duration) var(--owb-ease);
}

.owb-relmap-tab:hover {
  color: var(--orca-color-text-1);
}

.owb-relmap-tab.is-active {
  background: var(--orca-color-bg-1);
  color: var(--orca-color-text-1);
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

/* Body List */
.owb-relmap-body {
  flex: 1 1 auto;
  max-height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}

.owb-relmap-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px 12px;
  color: var(--orca-color-text-3);
  font-size: 11px;
}

.owb-relmap-empty i {
  font-size: 20px;
}

.owb-relmap-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.owb-relmap-group-title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--orca-color-text-3);
  padding: 2px 4px;
}

.owb-relmap-group-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  flex: 0 0 auto;
}

.owb-relmap-group-dot.is-off {
  background: var(--orca-color-warning-5, #f4a259);
}

.owb-relmap-group-dot.is-on {
  background: var(--orca-color-success-5, #2ba870);
}

.owb-relmap-group-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* List Item */
.owb-relmap-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 26px;
  padding: 4px 6px;
  border-radius: var(--owb-radius-sm, 4px);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 120ms ease, border-color 120ms ease;
}

.owb-relmap-item:hover {
  background: var(--orca-color-bg-2);
}

.owb-relmap-item.is-onboard {
  border-left: 2.5px solid var(--orca-color-success-5, #2ba870);
}

.owb-relmap-item.is-offboard {
  border-left: 2.5px solid var(--orca-color-warning-5, #f4a259);
}

.owb-relmap-item-main {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1 1 auto;
  min-width: 0;
}

.owb-relmap-kind-icon {
  flex: 0 0 auto;
  font-size: 13px;
  color: var(--orca-color-text-2);
}

.owb-relmap-item-title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--orca-color-text-1);
}

.owb-relmap-dir {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  padding: 0 2px;
  border-radius: 2px;
}

.owb-relmap-dir.is-in {
  color: var(--orca-color-primary-5);
}

.owb-relmap-dir.is-out {
  color: var(--orca-color-text-2);
}

.owb-relmap-dir.is-both {
  color: var(--orca-color-warning-5, #f4a259);
}

.owb-relmap-item-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
}

.owb-relmap-pill.is-on {
  font-size: 12px;
  color: var(--orca-color-text-3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.owb-relmap-item:hover .owb-relmap-pill.is-on {
  color: var(--orca-color-primary-5);
}

.owb-relmap-action-btn {
  appearance: none;
  width: 20px;
  height: 20px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--orca-color-border);
  border-radius: var(--owb-radius-sm, 3px);
  background: var(--orca-color-bg-1);
  color: var(--orca-color-text-1);
  cursor: pointer;
  transition: all var(--owb-duration) var(--owb-ease);
}

.owb-relmap-action-btn:hover {
  background: var(--orca-color-primary-5);
  color: #ffffff;
  border-color: var(--orca-color-primary-5);
}

.owb-relmap-more {
  font-size: 11px;
  color: var(--orca-color-text-3);
  text-align: center;
  padding: 4px 0;
}

/* Dynamic Preview Snippet */
.owb-relmap-preview {
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-height: 38px;
  padding: 6px 8px;
  border-radius: var(--owb-radius-sm, 4px);
  background: var(--orca-color-bg-2);
  border-left: 3px solid var(--orca-color-border);
  font-size: 11px;
  line-height: 1.4;
  color: var(--orca-color-text-3);
  transition: all 140ms ease;
}

.owb-relmap-preview.is-active {
  background: color-mix(in oklab, var(--orca-color-primary-5) 8%, var(--orca-color-bg-2));
  border-left-color: var(--orca-color-primary-5);
  color: var(--orca-color-text-1);
}

.owb-relmap-preview i {
  flex: 0 0 auto;
  font-size: 13px;
  margin-top: 1px;
}

.owb-relmap-preview.is-active i {
  color: var(--orca-color-primary-5);
}

.owb-relmap-preview-text {
  flex: 1 1 auto;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Footer */
.owb-relmap-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid var(--orca-color-border);
  font-size: 10.5px;
}

.owb-relmap-stat-text {
  color: var(--orca-color-text-2);
  font-weight: 600;
}

.owb-relmap-hint-text {
  color: var(--orca-color-text-3);
}
`.trim();
