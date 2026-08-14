/** Styles for embedding Orca's block editor inside a whiteboard card. */
export const CARD_EDITOR_CSS = `
/* Seamless Block Editor (0-Shift Layout Alignment) */
.owb-card-editor {
  /* Orca lays the editor out as a grid with wide side gutters
     (--orca-spacing-block) around a centred text column. Inside a card that
     eats ~130px of width, so collapse the gutters and let the text column
     use the full card width. */
  --orca-spacing-block: 0px;
  --orca-editor-min-width: 0px;
  --orca-editor-max-width: 100%;
}

.owb-card-editor,
.owb-card-editor .orca-panel,
.owb-card-editor .orca-hideable,
.owb-card-editor .orca-block-editor,
.owb-card-editor .orca-block-editor-main {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  margin: 0 !important;
  padding: 0 !important;
}

/* One scroller only: the editor scrolls, the card body does not double up. */
.owb-card-editor .orca-block-editor {
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.owb-card:hover .owb-card-editor .orca-block-editor {
  scrollbar-color: color-mix(in oklab, var(--orca-color-text-3) 30%, transparent) transparent;
}

.owb-card-editor .orca-block-editor::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.owb-card-editor .orca-block-editor::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 6px;
}

.owb-card:hover .owb-card-editor .orca-block-editor::-webkit-scrollbar-thumb {
  background: color-mix(in oklab, var(--orca-color-text-3) 30%, transparent);
}

/* Card edit: body + children only. Keep bullets and indent visible. */
.owb-card-editor .orca-block-editor-title,
.owb-card-editor .orca-block-editor-header,
.owb-card-editor .orca-block-editor-cover,
.owb-card-editor .orca-block-breadcrumb,
.owb-card-editor .orca-scrolling-breadcrumb,
.owb-card-editor .orca-block-editor-properties,
.owb-card-editor .orca-block-editor-query-tabs-container,
.owb-card-editor .orca-block-editor-query-views,
.owb-card-editor .orca-query-editor,
.owb-card-editor .orca-block-editor-sidetools {
  display: none !important;
}

/* Read-only cards stay compact, but bullets stay visible so the outline
   structure reads the same as in the note. Only the drag/menu chrome goes. */
.owb-card:not(.is-editing) .orca-block-handle,
.owb-card:not(.is-editing) .orca-block-drag-handle,
.owb-card:not(.is-editing) .orca-block-selected-bg {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  width: 0 !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
}

.owb-card.is-editing .orca-block-handle,
.owb-card.is-editing .orca-block-drag-handle {
  display: none !important;
}

.owb-card:not(.is-editing) .orca-block-children {
  padding-left: 12px !important;
}

.owb-card:not(.is-editing) .orca-block {
  margin-left: 0 !important;
  padding-left: 0 !important;
}
.owb-card-editor-missing {
  padding: var(--owb-space-2);
  color: var(--orca-color-text-3);
  font-size: 12px;
}
`.trim();
