import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { asBlockId } from "./pageBoardPlan";

export type CardBoardRef = { id: DbId; name: string };

export type ActivePanelLike = {
  view?: unknown;
  viewArgs?: { blockId?: unknown } | null;
} | null | undefined;

/** Tooltip text. Format is fixed; callers decide which names to pass. */
export function markLabelFor(
  names: readonly string[] | undefined,
): string | null {
  if (names == null || names.length === 0) return null;
  if (names.length === 1) {
    return t('On the "${name}" whiteboard', { name: names[0] });
  }
  return t("On ${count} whiteboards", { count: String(names.length) });
}

/**
 * Whether the outline row should show the "on whiteboard X" chip, and what
 * it should say. Unknown current board → keep today's label (never hide).
 */
export function outlineMarkLabel(
  boards: readonly CardBoardRef[] | undefined,
  currentBoardId: DbId | null,
): string | null {
  if (boards == null || boards.length === 0) return null;
  if (currentBoardId == null) {
    return markLabelFor(boards.map((board) => board.name));
  }
  const others = boards.filter((board) => board.id !== currentBoardId);
  if (others.length === 0) return null;
  return markLabelFor(others.map((board) => board.name));
}

/**
 * Current whiteboard from the active panel. `whiteboard.board` is enough;
 * a `block` view only counts when the caller already knows it is a board.
 */
export function currentBoardIdFromPanel(
  panel: ActivePanelLike,
  opts: { panelType: string; isWhiteboardView?: boolean },
): DbId | null {
  if (panel == null) return null;
  const id = asBlockId(panel.viewArgs?.blockId);
  if (id == null) return null;
  if (panel.view === opts.panelType) return id;
  if (panel.view === "block" && opts.isWhiteboardView === true) return id;
  return null;
}
