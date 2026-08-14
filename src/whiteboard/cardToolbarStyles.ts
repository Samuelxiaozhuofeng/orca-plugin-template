/** Styles for the card colour themes, floating toolbar and edge anchors. */
export const CARD_CHROME_CSS = `
/* Card Color Themes (Apple Color Palette) */
.owb-card.owb-card-theme-blue {
  background: color-mix(in oklab, #2F80ED 8%, var(--orca-color-bg-1));
  border-color: color-mix(in oklab, #2F80ED 25%, transparent);
}
.owb-card.owb-card-theme-green {
  background: color-mix(in oklab, #22C55E 8%, var(--orca-color-bg-1));
  border-color: color-mix(in oklab, #22C55E 25%, transparent);
}
.owb-card.owb-card-theme-yellow {
  background: color-mix(in oklab, #EAB308 10%, var(--orca-color-bg-1));
  border-color: color-mix(in oklab, #EAB308 30%, transparent);
}
.owb-card.owb-card-theme-coral {
  background: color-mix(in oklab, #F43F5E 8%, var(--orca-color-bg-1));
  border-color: color-mix(in oklab, #F43F5E 25%, transparent);
}
.owb-card.owb-card-theme-purple {
  background: color-mix(in oklab, #A855F7 8%, var(--orca-color-bg-1));
  border-color: color-mix(in oklab, #A855F7 25%, transparent);
}

/* Floating Card Micro-Toolbar (Translucent Glassmorphism) */
.owb-card-floating-toolbar {
  position: absolute;
  top: 8px;
  right: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  border-radius: 8px;
  background: color-mix(in oklab, var(--orca-color-bg-1) 85%, transparent);
  -webkit-backdrop-filter: saturate(180%) blur(12px);
  backdrop-filter: saturate(180%) blur(12px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 0 0 1px var(--orca-color-border-2, rgba(0, 0, 0, 0.08));
  opacity: 0;
  transform: translateY(-2px);
  pointer-events: none;
  transition: opacity 160ms ease, transform 160ms ease;
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
  border: none;
  background: transparent;
  color: var(--orca-color-text-2);
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.owb-card-tb-btn:hover {
  background: color-mix(in oklab, var(--orca-color-text-3) 15%, transparent);
  color: var(--orca-color-text-1);
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
  border-radius: 8px;
  background: var(--orca-color-bg-1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 0 0 1px var(--orca-color-border);
  z-index: 20;
}

.owb-card-color-dot {
  appearance: none;
  border: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
}

.owb-card-color-dot:hover {
  transform: scale(1.2);
}

.owb-card-color-dot.is-active {
  box-shadow: 0 0 0 2px var(--orca-color-primary-5, #2F80ED);
  transform: scale(1.15);
}

/* Connection Anchor Dots with Magnetic Scale Pulse */
.owb-card-anchor {
  position: absolute;
  z-index: 12;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--orca-color-primary-5, #2F80ED);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  opacity: 0;
  transform: scale(0.6);
  transition: opacity 150ms ease, transform 150ms ease;
  cursor: pointer;
}

.owb-card:hover .owb-card-anchor,
.owb-card.is-selected .owb-card-anchor {
  opacity: 0.85;
  transform: scale(1);
}

.owb-card-anchor:hover {
  opacity: 1 !important;
  transform: scale(1.35) !important;
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--orca-color-primary-5, #2F80ED) 25%, transparent);
}

.owb-card-anchor-t { top: -5px; left: 50%; margin-left: -5px; }
.owb-card-anchor-r { top: 50%; right: -5px; margin-top: -5px; }
.owb-card-anchor-b { bottom: -5px; left: 50%; margin-left: -5px; }
.owb-card-anchor-l { top: 50%; left: -5px; margin-top: -5px; }
`.trim();
