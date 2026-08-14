/**
 * Host surfaces that mount outside the card (typically on document.body).
 *
 * plugin-docs/ and src/orca.d.ts do not name these classes. The list is
 * taken from official themes and other plugins that already probe Orca DOM:
 *   .orca-popup / .orca-menu / .orca-tooltip  — official-themes aurora-borealis
 *   .orca-context-menu / .orca-select-menu / .orca-block-preview-popup /
 *   .orca-tag-popup                          — better-motion
 *   .orca-editor-toolbar / .orca-modal        — orca-srs
 *
 * role=* is a loose fallback for completion / picker surfaces whose class
 * is not documented. Confirm in a real Orca session.
 */
const HOST_OVERLAY_SELECTOR = [
  ".orca-popup",
  ".orca-menu",
  ".orca-context-menu",
  ".orca-select-menu",
  ".orca-block-preview-popup",
  ".orca-tag-popup",
  ".orca-editor-toolbar",
  ".orca-modal",
  ".orca-modal-content",
  ".orca-tooltip",
  '[role="menu"]',
  '[role="listbox"]',
  '[role="dialog"]',
].join(", ");

export function isHostOverlayTarget(target: EventTarget | null): boolean {
  const el =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  return el?.closest(HOST_OVERLAY_SELECTOR) != null;
}
