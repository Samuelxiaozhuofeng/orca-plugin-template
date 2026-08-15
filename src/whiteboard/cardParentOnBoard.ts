import type { Block, DbId } from "../orca.d.ts";

/** Chip on an extracted card that points back at the card it came from. */
export const CARD_BACK_CLASS = "owb-card-back";
/** Transient highlight on the source row after jumping back. */
export const CARD_ROW_FLASH_CLASS = "is-row-flash";
const FLASH_MS = 1600;
/** Guard against a cyclic or pathologically deep parent chain. */
const MAX_WALK = 64;

/**
 * Nearest ancestor of `blockId` that is its own card on this board.
 * Returns null when the chain leaves the board (or data is missing).
 */
export function findParentCardOnBoard(
  blockId: DbId,
  boardCardIds: ReadonlySet<DbId> | null | undefined,
  getBlock: (id: DbId) => Block | undefined,
): DbId | null {
  if (boardCardIds == null || boardCardIds.size === 0) return null;
  let current = getBlock(blockId);
  for (let i = 0; i < MAX_WALK; i++) {
    const parent = current?.parent;
    if (typeof parent !== "number" || !Number.isFinite(parent)) return null;
    if (parent === blockId) return null;
    if (boardCardIds.has(parent)) return parent;
    current = getBlock(parent);
    if (current == null) return null;
  }
  return null;
}

/** Scroll the source row into view and flash it. Silent when absent. */
export function flashCardRow(cardBlockId: DbId, rowBlockId: DbId): void {
  try {
    const card = document.querySelector(
      `.owb-card[data-block-id="${cardBlockId}"]`,
    );
    const row = card?.querySelector(`[data-owb-row-id="${rowBlockId}"]`);
    if (!(row instanceof HTMLElement)) return;
    row.scrollIntoView({ block: "nearest" });
    row.classList.remove(CARD_ROW_FLASH_CLASS);
    // Force a reflow so a repeated jump restarts the animation.
    void row.offsetWidth;
    row.classList.add(CARD_ROW_FLASH_CLASS);
    window.setTimeout(() => {
      row.classList.remove(CARD_ROW_FLASH_CLASS);
    }, FLASH_MS);
  } catch {
    /* host DOM changed — the jump itself already happened */
  }
}

export const CARD_BACK_CSS = `
.owb-card-back {
  position: absolute;
  right: 8px;
  bottom: 6px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: 60%;
  padding: 1px 6px;
  border: none;
  border-radius: 3px;
  background: color-mix(in srgb, var(--orca-color-primary-5, #2F80ED) 14%, transparent);
  color: var(--orca-color-primary-5, #2F80ED);
  font-size: 11px;
  line-height: 1.5;
  white-space: nowrap;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--owb-duration) var(--owb-ease);
}

.owb-card:hover .owb-card-back,
.owb-card.is-selected .owb-card-back {
  opacity: 0.9;
  pointer-events: auto;
}

.owb-card-back:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--orca-color-primary-5, #2F80ED) 24%, transparent);
}

.owb-card-block-node.is-row-flash {
  animation: owb-row-flash 1.6s var(--owb-ease);
}

@keyframes owb-row-flash {
  0%, 60% {
    background-color: color-mix(in srgb, var(--orca-color-warning-5, #f4a259) 45%, transparent);
  }
  100% {
    background-color: color-mix(in srgb, var(--orca-color-primary-5, #2F80ED) 10%, transparent);
  }
}
`.trim();
