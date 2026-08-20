import type { DbId } from "../orca.d.ts";
import type { PresentSavedPosition } from "./presentation.ts";

/** In-memory cache of the last viewed slide position per board block ID. */
const memory = new Map<DbId, PresentSavedPosition>();

export function getRememberedPresentation(
  boardBlockId: DbId | null | undefined,
): PresentSavedPosition | null {
  if (boardBlockId == null) return null;
  return memory.get(boardBlockId) ?? null;
}

export function rememberPresentation(
  boardBlockId: DbId | null | undefined,
  position: PresentSavedPosition | null,
): void {
  if (boardBlockId == null) return;
  if (position == null) {
    memory.delete(boardBlockId);
  } else {
    memory.set(boardBlockId, position);
  }
}

export function clearPresentationMemory(): void {
  memory.clear();
}
