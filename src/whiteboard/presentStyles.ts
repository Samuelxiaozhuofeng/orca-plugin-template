export const PRESENT_CSS = `
.owb-present-overlay {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 16px;
  border-radius: 9999px;
  background: color-mix(in oklab, var(--orca-color-bg-1) 85%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--orca-color-border-1, rgba(0, 0, 0, 0.12));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  color: var(--orca-color-text-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  z-index: 10;
  user-select: none;
  pointer-events: auto;
}

.owb-present-label {
  white-space: nowrap;
}

.owb-present-close {
  appearance: none;
  border: none;
  background: transparent;
  padding: 2px;
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--orca-color-text-2);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.owb-present-close:hover {
  background: color-mix(in oklab, var(--orca-color-text-1) 10%, transparent);
  color: var(--orca-color-text-1);
}

/* Fallback when the native fullscreen API is unavailable: cover the whole
   window client area instead. 400 clears every z-index this plugin uses (max 360). */
.owb-panel.is-present-cover {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: var(--orca-color-bg-1);
}

.owb-panel:fullscreen {
  background: var(--orca-color-bg-1);
}

/* While a section is being walked card by card, everything not yet spoken to
   recedes; the current card keeps a subtle ring so the eye lands on it. */
.owb-panel.is-presenting.is-revealing .owb-card.is-present-dim {
  opacity: 0.18;
}
.owb-panel.is-presenting .owb-card {
  transition: opacity 200ms ease-out;
  cursor: default;
}
.owb-panel.is-presenting .owb-card-body {
  cursor: default;
}
/* Panning starts on the card itself, so a drag must not smear a text
   selection across the slide. Clicks still reach refs and links. */
.owb-panel.is-presenting .owb-card {
  user-select: none;
}
.owb-panel.is-presenting .owb-card input[type="checkbox"],
.owb-panel.is-presenting .owb-card .orca-checkbox {
  pointer-events: none !important;
}
.owb-panel.is-presenting .owb-card-handle,
.owb-panel.is-presenting .owb-card-floating-toolbar,
.owb-panel.is-presenting .owb-card-back,
.owb-panel.is-presenting .owb-edge-layer {
  display: none !important;
}
.owb-panel.is-presenting .owb-card.is-present-current {
  box-shadow: 0 0 0 2px var(--orca-color-primary-5, #00a896);
}

.owb-slide-outline {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 240px;
  max-height: calc(100% - 32px);
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  background: color-mix(in oklab, var(--orca-color-bg-1) 85%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--orca-color-border-1, rgba(0, 0, 0, 0.12));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  color: var(--orca-color-text-1);
  font-size: 13px;
  z-index: 40;
  user-select: none;
  pointer-events: auto;
  overflow: hidden;
}

.owb-slide-outline-resume {
  cursor: pointer;
  color: var(--orca-color-primary-5, #00a896);
  border-bottom: 1px solid var(--orca-color-border-1, rgba(0, 0, 0, 0.08));
  margin-bottom: 4px;
}
.owb-slide-outline-resume .owb-slide-outline-name {
  color: var(--orca-color-primary-5, #00a896);
  font-weight: 600;
}
.owb-slide-outline-resume-icon {
  font-size: 14px;
  margin-right: 6px;
  flex-shrink: 0;
}

.owb-slide-outline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--orca-color-border-1, rgba(0, 0, 0, 0.08));
  font-weight: 600;
  font-size: 13px;
}

.owb-slide-outline-title {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.owb-slide-outline-close {
  appearance: none;
  border: none;
  background: transparent;
  padding: 2px;
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--orca-color-text-2);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.owb-slide-outline-close:hover {
  background: color-mix(in oklab, var(--orca-color-text-1) 10%, transparent);
  color: var(--orca-color-text-1);
}

.owb-slide-outline-empty {
  padding: 16px 12px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--orca-color-text-2);
  text-align: center;
}

.owb-slide-outline-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.owb-slide-outline-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid transparent;
  cursor: grab;
  touch-action: none;
}

.owb-slide-outline-item:hover {
  background: color-mix(in oklab, var(--orca-color-text-1) 8%, transparent);
}

.owb-slide-outline-item.is-dragging {
  opacity: 0.35;
  background: color-mix(in oklab, var(--orca-color-text-1) 12%, transparent);
}

.owb-slide-outline-item-text {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
}

.owb-slide-outline-num {
  font-weight: 600;
  color: var(--orca-color-text-2);
  flex-shrink: 0;
}

.owb-slide-outline-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owb-slide-outline-dot {
  color: var(--orca-color-text-2);
  flex-shrink: 0;
  white-space: pre;
}

.owb-slide-outline-count {
  color: var(--orca-color-text-2);
  flex-shrink: 0;
}

.owb-slide-outline-item-remove {
  appearance: none;
  border: none;
  background: transparent;
  padding: 2px;
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--orca-color-text-2);
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  opacity: 0.6;
  flex-shrink: 0;
}

.owb-slide-outline-item-remove:hover {
  opacity: 1;
  background: color-mix(in oklab, var(--orca-color-text-1) 10%, transparent);
  color: var(--orca-color-text-1);
}

.owb-slide-outline-indicator {
  position: absolute;
  left: 6px;
  right: 6px;
  height: 2px;
  background: var(--orca-color-primary-5, #00a896);
  border-radius: 1px;
  pointer-events: none;
  z-index: 2;
}
`.trim();
