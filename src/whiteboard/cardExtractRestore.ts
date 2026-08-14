import type { NoteHistoryAction } from "./boardHistory";
import { fetchBlock } from "./newCard";
import {
  EXTRACT_FROM_PROP,
  lastChildLeftId,
  planBoardAfterRestore,
  planRestoreAnchor,
  type ExtractRestoreInfo,
} from "./cardExtractModel";
import {
  deleteTextPropBestEffort,
  moveBlockOutAsExtract,
  moveBlocksTo,
} from "./cardExtractMove";
import { deleteBlockBestEffort } from "./noteWrite";

export type { ExtractRestoreInfo };
export { planBoardAfterRestore };

export async function restoreExtractMove(
  info: ExtractRestoreInfo,
): Promise<void> {
  const parent = await fetchBlock(info.originParentId);
  const children = parent.children ?? [];
  const anchor = planRestoreAnchor({
    originParentId: info.originParentId,
    originLeftId: info.originLeftId,
    stubId: info.stubId,
    parentChildren: children,
  });
  let leftId = anchor.leftId;
  if (leftId === info.movedId) {
    const idx = children.indexOf(info.movedId);
    leftId = idx > 0 ? (children[idx - 1] ?? null) : null;
  } else if (leftId != null && !children.includes(leftId)) {
    leftId = lastChildLeftId(children, new Set([info.movedId]));
  }
  await moveBlocksTo([info.movedId], anchor.parentId, leftId);
  if (info.stubId !== info.movedId) {
    await deleteBlockBestEffort(info.stubId);
  }
  await deleteTextPropBestEffort(info.movedId, EXTRACT_FROM_PROP);
  try {
    await fetchBlock(info.originParentId);
  } catch {
    // parent refresh is best-effort after the stub is gone
  }
}

export async function reapplyExtractMove(
  info: ExtractRestoreInfo,
): Promise<void> {
  const next = await moveBlockOutAsExtract({
    blockId: info.movedId,
    sourceCardId: info.sourceCardId,
    boardBlockId: info.boardBlockId,
  });
  info.stubId = next.stubId;
  info.originParentId = next.originParentId;
  info.originLeftId = next.originLeftId;
}

export function makeExtractNoteAction(
  infos: ExtractRestoreInfo[],
): NoteHistoryAction {
  return {
    undo: async () => {
      for (let i = infos.length - 1; i >= 0; i--) {
        const info = infos[i];
        if (info == null) continue;
        await restoreExtractMove(info);
      }
    },
    redo: async () => {
      for (const info of infos) {
        await reapplyExtractMove(info);
      }
    },
  };
}

export function invertNoteAction(note: NoteHistoryAction): NoteHistoryAction {
  return { undo: note.redo, redo: note.undo };
}
