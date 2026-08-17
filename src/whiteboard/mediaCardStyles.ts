import { MEDIA_CARD_HEADER_H } from "./mediaCard.ts";

export const MEDIA_CARD_CSS = `
/* Media cards: drop outline chrome on the root media row and let the
   hosted media fill the body. Every rule is gated by .owb-card.is-media
   so ordinary / board / simplified cards keep their current look. */

/* Chrome is on when the card is hovered, selected, edited, gestured,
   marquee-hit, focus-flashed, or mid-connect. Rest = the inverse. */
.owb-card.is-media:not(:hover):not(.is-selected):not(.is-editing):not(.is-dragging):not(.is-resizing):not(.is-marquee-hit):not(.is-focus-flash):not(:has(.owb-card-tb-btn.is-connecting)) {
  background: transparent;
  border-color: transparent;
}

.owb-card.is-media {
  --owb-media-header-h: ${MEDIA_CARD_HEADER_H}px;
  transition:
    transform var(--owb-duration) var(--owb-ease),
    border-color var(--owb-duration) var(--owb-ease),
    background var(--owb-duration) var(--owb-ease);
}

.owb-card.is-media.is-dragging,
.owb-card.is-media.is-resizing {
  transition: none;
}

/* Overlay the title so showing it never shortens the media box.
   Editing / simplified keep the in-flow header (editor needs the
   slot; simplified has no media — the title IS the content). */
.owb-card.is-media:not(.is-editing):not(.is-simplified) .owb-card-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 4;
  border-bottom-color: transparent;
  background: linear-gradient(
    to bottom,
    color-mix(in oklab, var(--orca-color-bg-1) 88%, transparent),
    color-mix(in oklab, var(--orca-color-bg-1) 42%, transparent) 64%,
    transparent
  );
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity var(--owb-duration) var(--owb-ease),
    visibility var(--owb-duration) var(--owb-ease),
    padding-right var(--owb-duration) var(--owb-ease);
}

.owb-card.is-media:not(.is-editing):not(.is-simplified):is(:hover, .is-selected, .is-dragging, .is-resizing, .is-marquee-hit, .is-focus-flash, :has(.owb-card-tb-btn.is-connecting)) .owb-card-header {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

/* Video keeps a permanent strip for the title instead of letting it sit on
   the picture. The strip is reserved even while the title is hidden, so
   hovering never shifts or shrinks the player. */
.owb-card.is-media.owb-card-media-video:not(.is-editing):not(.is-simplified) .owb-card-header {
  box-sizing: border-box;
  height: var(--owb-media-header-h);
  overflow: hidden;
  background: none;
}

.owb-card.is-media.owb-card-media-video:not(.is-editing):not(.is-simplified) .owb-card-body {
  padding-top: var(--owb-media-header-h);
}

.owb-card.is-media .owb-card-handle {
  opacity: 0;
  transition: opacity var(--owb-duration) var(--owb-ease);
}

.owb-card.is-media:is(:hover, .is-selected, .is-editing, .is-dragging, .is-resizing, .is-marquee-hit, .is-focus-flash, :has(.owb-card-tb-btn.is-connecting)) .owb-card-handle {
  opacity: 1;
}

.owb-card.is-media:is(.is-dragging, .is-resizing, .is-marquee-hit, .is-focus-flash) .owb-card-floating-toolbar {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.owb-card.is-media:not(.is-editing) .owb-card-body {
  padding: 0;
  display: flex;
  flex-direction: column;
}

.owb-card.is-media:not(.is-editing) .owb-card-block-tree {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.owb-card.is-media .owb-card-block-node[data-depth="0"] > .owb-extract-bullet {
  display: none;
}

.owb-card.is-media:not(.is-editing) .owb-card-block-node[data-depth="0"] {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  gap: 0;
  align-items: stretch;
}

.owb-card.is-media:not(.is-editing)
  .owb-card-block-node[data-depth="0"]
  ~ .owb-card-block-node {
  flex: 0 0 auto;
  margin-left: 14px;
  margin-right: 14px;
}

.owb-card.is-media:not(.is-editing)
  .owb-card-block-node[data-depth="0"]
  ~ .owb-card-block-node:last-child {
  margin-bottom: 12px;
}

.owb-card.is-media .owb-card-block-node[data-depth="0"] .orca-block-handle,
.owb-card.is-media .owb-card-block-node[data-depth="0"] .orca-repr-main:after {
  display: none;
}

.owb-card.is-media:not(.is-editing) .owb-card-block-node[data-depth="0"] > .orca-block,
.owb-card.is-media:not(.is-editing) .owb-card-block-node[data-depth="0"] .orca-repr,
.owb-card.is-media:not(.is-editing) .owb-card-block-node[data-depth="0"] .orca-repr-main,
.owb-card.is-media:not(.is-editing) .owb-card-block-node[data-depth="0"] .orca-repr-main-content,
.owb-card.is-media:not(.is-editing) .owb-card-block-node[data-depth="0"] .orca-no-editable-container {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  max-width: 100%;
}

.owb-card.is-media:not(.is-editing)
  .owb-card-block-node[data-depth="0"]
  .orca-repr-main-content
  > .orca-no-editable-container {
  padding: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.owb-card.is-media:not(.is-editing):not(.owb-card-media-audio)
  .owb-card-block-node[data-depth="0"]
  img,
.owb-card.is-media:not(.is-editing):not(.owb-card-media-audio)
  .owb-card-block-node[data-depth="0"]
  video,
.owb-card.is-media:not(.is-editing):not(.owb-card-media-audio)
  .owb-card-block-node[data-depth="0"]
  canvas {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.owb-card.is-media.owb-card-media-image:not(.is-editing)
  .owb-card-block-node[data-depth="0"]
  .orca-image-wrapper {
  width: 100%;
  height: 100%;
  max-width: 100%;
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.owb-card.is-media.owb-card-media-image:not(.is-editing)
  .owb-card-block-node[data-depth="0"]
  .orca-image-image {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.owb-card.is-media.owb-card-media-video:not(.is-editing)
  .owb-card-block-node[data-depth="0"]
  .orca-video-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.owb-card.is-media.owb-card-media-video:not(.is-editing)
  .owb-card-block-node[data-depth="0"]
  .orca-video,
.owb-card.is-media.owb-card-media-video:not(.is-editing)
  .owb-card-block-node[data-depth="0"]
  .orca-video-webview {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  aspect-ratio: unset;
  object-fit: contain;
}

.owb-card.is-media.owb-card-media-audio:not(.is-editing)
  .owb-card-block-node[data-depth="0"]
  .orca-no-editable-container {
  justify-content: center;
}

.owb-card.is-media.owb-card-media-audio:not(.is-editing)
  .owb-card-block-node[data-depth="0"]
  .orca-audio {
  width: 100%;
  display: block;
  box-sizing: border-box;
}

.owb-card.is-media:is(.owb-card-media-pdf, .owb-card-media-epub):not(.is-editing)
  .owb-card-block-node[data-depth="0"]
  :is(.orca-pdf-linkview, .orca-epub-linkview) {
  width: 100%;
  height: 100%;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.owb-card.is-media:is(.owb-card-media-pdf, .owb-card-media-epub):not(.is-editing)
  .owb-card-block-node[data-depth="0"]
  :is(.orca-pdf-linkview, .orca-epub-linkview)
  a {
  width: 100%;
  height: 100%;
  flex-flow: column nowrap;
  align-items: center;
  justify-content: center;
  gap: 0;
}

.owb-card.is-media:is(.owb-card-media-pdf, .owb-card-media-epub):not(.is-editing)
  .owb-card-block-node[data-depth="0"]
  :is(.orca-pdf-linkview-cover, .orca-epub-linkview-cover) {
  width: auto;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  aspect-ratio: 3 / 4;
  flex: 0 1 auto;
}

.owb-card.is-media:is(.owb-card-media-pdf, .owb-card-media-epub):not(.is-editing)
  .owb-card-block-node[data-depth="0"]
  :is(.orca-pdf-linkview-cover, .orca-epub-linkview-cover)
  img {
  object-fit: contain;
}

.owb-card.is-media:is(.owb-card-media-pdf, .owb-card-media-epub):not(.is-editing)
  .owb-card-block-node[data-depth="0"]
  :is(.orca-pdf-linkview, .orca-epub-linkview)
  .orca-inline-l-text {
  display: none;
}
`.trim();
