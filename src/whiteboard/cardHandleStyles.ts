/**
 * Styles for card resize handles and viewport transition animations.
 */
export const CARD_HANDLE_CSS = `
/* Card Resize Handles */
.owb-card-handle {
  position: absolute;
  z-index: 5;
  box-sizing: border-box;
  background: transparent;
  border: none;
  box-shadow: none;
  pointer-events: auto;
}

.owb-card-handle-n,
.owb-card-handle-s {
  left: 12px;
  right: 12px;
  height: 8px;
  cursor: ns-resize;
}

.owb-card-handle-e,
.owb-card-handle-w {
  top: 12px;
  bottom: 12px;
  width: 8px;
  cursor: ew-resize;
}

.owb-card-handle-n { top: 0; }
.owb-card-handle-s { bottom: 0; }
.owb-card-handle-e { right: 0; }
.owb-card-handle-w { left: 0; }

.owb-card-handle-ne,
.owb-card-handle-nw,
.owb-card-handle-se,
.owb-card-handle-sw {
  width: 12px;
  height: 12px;
}

.owb-card-handle-ne { top: 0; right: 0; cursor: nesw-resize; }
.owb-card-handle-nw { top: 0; left: 0; cursor: nwse-resize; }
.owb-card-handle-se { bottom: 0; right: 0; cursor: nwse-resize; }
.owb-card-handle-sw { bottom: 0; left: 0; cursor: nesw-resize; }

@keyframes owb-card-focus-flash {
  0%, 50%, 100% {
    border-color: var(--orca-color-primary-5, #00a896);
  }
  25%, 75% {
    border-color: var(--orca-color-warning-5, #f4a259);
  }
}

.owb-card.is-focus-flash {
  z-index: 6;
  animation: owb-card-focus-flash 1200ms ease-in-out;
}

.owb-canvas.is-view-animating {
  transition: transform 240ms ease-out;
}

.owb-grid.is-view-animating {
  transition:
    background-position 240ms ease-out,
    background-size 240ms ease-out;
}
`.trim();
