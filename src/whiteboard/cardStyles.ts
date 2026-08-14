export const CARD_CSS = `
.owb-viewport[data-mouse-scheme="rightDrag"] .owb-card:not(.is-editing):not(.is-dragging) {
  cursor: default;
}

.owb-card {
  position: absolute;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  cursor: grab;
  background: var(--orca-color-bg-1);
  border: none;
  border-radius: 14px;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.04),
    0 8px 24px rgba(0, 0, 0, 0.06),
    0 0 0 1px var(--orca-color-border-2, rgba(0, 0, 0, 0.08));
  transition:
    box-shadow var(--owb-duration) var(--owb-ease),
    transform var(--owb-duration) var(--owb-ease);
}

.owb-card:not(.is-editing) {
  user-select: none;
}

.owb-card:hover:not(.is-dragging):not(.is-resizing):not(.is-selected):not(.is-editing):not(.is-marquee-hit) {
  transform: translateY(-1px);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.06),
    0 12px 32px rgba(0, 0, 0, 0.08),
    0 0 0 1px var(--orca-color-border-2, rgba(0, 0, 0, 0.12));
}

.owb-card.is-selected:hover:not(.is-dragging):not(.is-editing),
.owb-card.is-editing:hover:not(.is-dragging) {
  transform: translateY(-1px);
}

.owb-card.is-dragging {
  z-index: 4;
  cursor: grabbing;
  transform: scale(1.02);
  transition: none;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.12),
    0 20px 48px rgba(0, 0, 0, 0.16),
    0 0 0 1px var(--orca-color-border-2, rgba(0, 0, 0, 0.12));
}

.owb-card.is-resizing {
  z-index: 4;
  transition: none;
}

/* Selected state with Apple Blue border and glow */
.owb-card.is-selected:not(.is-editing):not(.is-dragging):not(.is-resizing) {
  z-index: 2;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.08),
    0 0 0 2.5px var(--orca-color-primary-5, #2F80ED),
    0 0 0 6px color-mix(in oklab, var(--orca-color-primary-5, #2F80ED) 16%, transparent);
}

.owb-card.is-marquee-hit:not(.is-selected):not(.is-editing) {
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.04),
    0 0 0 2px color-mix(in oklab, var(--orca-color-primary-5, #2F80ED) 45%, transparent);
}

/* Editing state */
.owb-card.is-editing:not(.is-dragging):not(.is-resizing) {
  z-index: 3;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.08),
    0 0 0 2.5px var(--orca-color-primary-5, #2F80ED),
    0 0 0 6px color-mix(in oklab, var(--orca-color-primary-5, #2F80ED) 12%, transparent);
}

.owb-card.is-editing .owb-card-body {
  cursor: text;
}

/* Signature top-right blue diamond accent node (Heptabase / Apple standard) */
.owb-card-accent-diamond {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 6;
  width: 9px;
  height: 9px;
  background: var(--orca-color-primary-5, #2F80ED);
  transform: rotate(45deg);
  border-radius: 1.5px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  pointer-events: none;
}

/* Card title & headers */
.owb-card-header {
  display: flex;
  align-items: center;
  gap: var(--owb-space-2);
  padding: 12px 14px 4px 14px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  user-select: none;
  cursor: grab;
  color: var(--orca-color-text-1);
}

.owb-card-title-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.owb-card-page-icon {
  flex: 0 0 auto;
  font-size: 15px;
  color: var(--orca-color-text-2);
}

.owb-card-page {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Minimalist top-left floating weekday badge for journal notes */
.owb-card-journal-badge {
  position: absolute;
  top: 12px;
  left: 14px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  background: color-mix(in oklab, var(--orca-color-text-3) 12%, transparent);
  color: var(--orca-color-text-2);
  user-select: none;
  pointer-events: none;
  transition: background 150ms ease, color 150ms ease;
}

.owb-card-journal-badge.is-weekend {
  color: var(--orca-color-text-red, #E5484D);
  background: color-mix(in oklab, var(--orca-color-text-red, #E5484D) 12%, transparent);
}

.owb-card-journal-badge.is-today {
  color: var(--orca-color-primary-5, #2F80ED);
  background: color-mix(in oklab, var(--orca-color-primary-5, #2F80ED) 12%, transparent);
}

.owb-card-today-dot {
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.owb-card-badge-weekday {
  line-height: 1.3;
}

/* Card Body & Content Container */
.owb-card-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.6;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.owb-card:has(.owb-card-journal-badge) .owb-card-body {
  padding-top: 36px;
}

.owb-card:hover .owb-card-body {
  scrollbar-color: color-mix(in oklab, var(--orca-color-text-3) 30%, transparent) transparent;
}

.owb-card-body::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.owb-card-body::-webkit-scrollbar-track {
  background: transparent;
}

.owb-card-body::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 6px;
}

.owb-card:hover .owb-card-body::-webkit-scrollbar-thumb {
  background: color-mix(in oklab, var(--orca-color-text-3) 30%, transparent);
}

.owb-card-body::-webkit-scrollbar-button {
  display: none;
  width: 0;
  height: 0;
}

.owb-card-body > .orca-block:first-child,
.owb-card-body .orca-block:first-child {
  margin-top: 0;
}

.owb-card-body > .orca-block:last-child,
.owb-card-body .orca-block:last-child {
  margin-bottom: 0;
}

.owb-card-empty {
  font-size: 13px;
  line-height: 1.55;
  color: var(--orca-color-text-3);
  font-style: italic;
}

.owb-card-excerpt {
  margin: 0;
  line-height: 1.6;
  color: var(--orca-color-text-1);
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 8;
  white-space: pre-wrap;
  word-break: break-word;
}

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

/* Seamless Block Editor (0-Shift Layout Alignment) */
.owb-card-editor,
.owb-card-editor .orca-panel,
.owb-card-editor .orca-hideable,
.owb-card-editor .orca-block-editor,
.owb-card-editor .orca-block-editor-main {
  height: 100%;
  min-height: 0;
  margin: 0 !important;
  padding: 0 !important;
}

/* Hide heavy document editor chromes in card edit mode */
.owb-card-editor .orca-block-editor-title,
.owb-card-editor .orca-block-editor-header,
.owb-card-editor .orca-block-editor-cover,
.owb-card-editor .orca-block-breadcrumb,
.owb-card-editor .orca-scrolling-breadcrumb,
.owb-card-editor .orca-block-editor-properties {
  display: none !important;
}

/* Suppress outline bullets and drag handles inside cards for clean Heptabase text presentation */
.owb-card .orca-block-bullet,
.owb-card .orca-block-bullet-dot,
.owb-card .orca-block-handle,
.owb-card .orca-block-drag-handle,
.owb-card .orca-block-selected-bg,
.owb-card-editor .orca-block-bullet,
.owb-card-editor .orca-block-bullet-dot,
.owb-card-editor .orca-block-handle,
.owb-card-editor .orca-block-drag-handle,
.owb-card-editor .orca-block-selected-bg {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  width: 0 !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* Ensure clean text block alignment without indentation offset */
.owb-card .orca-block-children,
.owb-card-editor .orca-block-children {
  padding-left: 12px !important;
}

.owb-card .orca-block,
.owb-card-editor .orca-block {
  margin-left: 0 !important;
  padding-left: 0 !important;
}

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

.owb-card-editor-missing {
  padding: var(--owb-space-2);
  color: var(--orca-color-text-3);
  font-size: 12px;
}
`.trim();
