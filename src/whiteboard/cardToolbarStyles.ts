/** Styles for the card colour themes and floating toolbar. */
export const CARD_CHROME_CSS = `
/* Card Color Themes (Traditional Chinese Mineral Pigments) */
.owb-card.owb-card-theme-blue {
  background: color-mix(in oklab, #00a896 12%, var(--orca-color-bg-1));
  border-color: var(--orca-color-border);
}
.owb-card.owb-card-theme-green {
  background: color-mix(in oklab, #2ba870 12%, var(--orca-color-bg-1));
  border-color: var(--orca-color-border);
}
.owb-card.owb-card-theme-yellow {
  background: color-mix(in oklab, #f4a259 14%, var(--orca-color-bg-1));
  border-color: var(--orca-color-border);
}
.owb-card.owb-card-theme-coral {
  background: color-mix(in oklab, #d9381e 12%, var(--orca-color-bg-1));
  border-color: var(--orca-color-border);
}
.owb-card.owb-card-theme-purple {
  background: color-mix(in oklab, #8b5cf6 12%, var(--orca-color-bg-1));
  border-color: var(--orca-color-border);
}

/* Floating Card Micro-Toolbar (Neobrutalist Frame & Stamped Buttons) */
.owb-card-floating-toolbar {
  position: absolute;
  top: 8px;
  right: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  border-radius: var(--owb-radius-btn, 4px);
  background: var(--orca-color-bg-1);
  border: 1.5px solid var(--orca-color-border);
  box-shadow: 2px 2px 0px 0px var(--orca-color-border);
  opacity: 0;
  transform: translateY(-2px);
  pointer-events: none;
  transition: opacity var(--owb-duration) var(--owb-ease),
              transform var(--owb-duration) var(--owb-ease);
}

.owb-card:hover .owb-card-floating-toolbar,
.owb-card.is-selected .owb-card-floating-toolbar,
.owb-card.is-editing .owb-card-floating-toolbar {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.owb-card-tb-btn {
  appearance: none;
  border: 1px solid transparent;
  background: transparent;
  color: var(--orca-color-text-1);
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: var(--owb-radius-sm, 3px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  cursor: pointer;
  transition: transform var(--owb-duration) var(--owb-ease),
              background var(--owb-duration) var(--owb-ease),
              color var(--owb-duration) var(--owb-ease),
              box-shadow var(--owb-duration) var(--owb-ease);
}

.owb-card-tb-btn:hover {
  background: var(--orca-color-warning-5, #f4a259);
  color: #111417;
  border-color: var(--orca-color-border);
  box-shadow: 1.5px 1.5px 0px 0px var(--orca-color-border);
  transform: translate(-1px, -1px);
}

.owb-card-tb-btn:active {
  transform: translate(1px, 1px);
  box-shadow: none;
}

.owb-card-tb-btn.is-connecting {
  background: var(--orca-color-primary-5, #00a896);
  color: #111417;
  border-color: var(--orca-color-border);
  box-shadow: 1.5px 1.5px 0px 0px var(--orca-color-border);
  animation: owb-tb-connecting 1.2s ease-in-out infinite;
}

.owb-card:has(.owb-card-tb-btn.is-connecting) .owb-card-floating-toolbar {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

@keyframes owb-tb-connecting {
  50% { opacity: 0.72; }
}

.owb-card-tb-popover-wrapper {
  position: relative;
}

.owb-card-color-popover {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 8px;
  border-radius: var(--owb-radius-card, 6px);
  background: var(--orca-color-bg-1);
  border: 1.5px solid var(--orca-color-border);
  box-shadow: 3px 3px 0px 0px var(--orca-color-border);
  z-index: 20;
}

.owb-card-color-dot {
  appearance: none;
  border: 1px solid var(--orca-color-border);
  width: 16px;
  height: 16px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform var(--owb-duration) var(--owb-ease),
              box-shadow var(--owb-duration) var(--owb-ease);
}

.owb-card-color-dot:hover {
  transform: scale(1.25);
  box-shadow: 1.5px 1.5px 0px 0px var(--orca-color-border);
}

.owb-card-color-dot.is-active {
  border-color: var(--orca-color-border);
  box-shadow: 0 0 0 2px var(--orca-color-primary-5, #00a896), 2px 2px 0px 0px var(--orca-color-border);
  transform: scale(1.15);
}
`.trim();
