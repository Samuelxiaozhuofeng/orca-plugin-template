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

/* While a single card is being presented, the rest of the board recedes. */
.owb-panel.is-presenting.is-card-focus .owb-card {
  opacity: 0.15;
  transition: opacity 200ms ease-out;
}
.owb-panel.is-presenting.is-card-focus .owb-card.is-present-focus {
  opacity: 1;
}
`.trim();
