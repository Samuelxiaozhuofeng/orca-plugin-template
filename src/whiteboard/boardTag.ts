import type { CursorData, DbId } from "../orca.d.ts";
import {
  currentWhiteboardSettings,
  DEFAULT_BOARD_TAG,
} from "./settings";

export function normalizeBoardTag(raw: string): string {
  const alias = raw.trim().replace(/^#+/, "").trim();
  return alias || DEFAULT_BOARD_TAG;
}

export async function tagNewWhiteboard(
  blockId: DbId,
  cursor: CursorData | null,
): Promise<void> {
  const settings = currentWhiteboardSettings();
  if (!settings.autoTagNewBoards) return;
  const alias = normalizeBoardTag(settings.boardTag);
  try {
    await orca.commands.invokeEditorCommand(
      "core.editor.insertTag",
      cursor,
      blockId,
      alias,
    );
  } catch (err: unknown) {
    console.warn("[whiteboard] failed to tag new board", err);
  }
}
