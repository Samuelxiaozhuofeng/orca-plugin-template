import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { discardLastRecord, runAsHistoryStep } from "./boardHistory";
import type { WhiteboardCard } from "./cards";
import {
  findVacantCardPosition,
  parseExtractSource,
  planExtractEdge,
} from "./cardExtract";
import { type ExtractRestoreInfo } from "./cardExtractModel";
import { moveBlockOutAsExtract } from "./cardExtractMove";
import { makeExtractNoteAction } from "./cardExtractRestore";
import {
  dropMessage,
  parseDroppedBlockIds,
  placeDroppedBlocks,
} from "./dropBlocks";
import type { WhiteboardEdge } from "./edges";

export async function extractBlocksToBoard(opts: {
  ids: readonly DbId[];
  sourceCardId: DbId | null;
  at?: { x: number; y: number };
  existing: readonly WhiteboardCard[];
  existingEdges: readonly WhiteboardEdge[];
  boardBlockId: DbId;
  addCards: (cards: WhiteboardCard[]) => Promise<boolean>;
  commitEdges: (next: WhiteboardEdge[]) => Promise<boolean>;
}): Promise<WhiteboardCard[]> {
  if (opts.ids.length === 0) return [];

  const source =
    opts.sourceCardId != null
      ? opts.existing.find((card) => card.blockId === opts.sourceCardId)
      : undefined;
  const at = opts.at ?? findVacantCardPosition(opts.existing, source);

  const result = await placeDroppedBlocks({
    ids: opts.ids,
    at,
    existing: opts.existing,
    boardBlockId: opts.boardBlockId,
  });

  if (result.added === 0) {
    orca.notify("info", dropMessage(result));
    return [];
  }

  const edgesToAdd: WhiteboardEdge[] = [];
  if (opts.sourceCardId != null) {
    let planned: WhiteboardEdge[] = [...opts.existingEdges];
    for (const card of result.incoming) {
      const edge = planExtractEdge(opts.sourceCardId, card.blockId, planned);
      if (edge == null) continue;
      edgesToAdd.push(edge);
      planned = [...planned, edge];
    }
  }

  const infos: ExtractRestoreInfo[] = [];
  const note = makeExtractNoteAction(infos);

  const savedIncoming = await runAsHistoryStep(
    opts.boardBlockId,
    { cards: [...opts.existing], edges: [...opts.existingEdges] },
    async () => {
      try {
        for (const card of result.incoming) {
          infos.push(
            await moveBlockOutAsExtract({
              blockId: card.blockId,
              sourceCardId: opts.sourceCardId,
              boardBlockId: opts.boardBlockId,
            }),
          );
        }
        const saved = await opts.addCards(result.incoming);
        if (!saved) {
          await note.undo();
          discardLastRecord(opts.boardBlockId);
          return false;
        }
        if (edgesToAdd.length > 0) {
          const ok = await opts.commitEdges([
            ...opts.existingEdges,
            ...edgesToAdd,
          ]);
          if (!ok) {
            orca.notify("error", t("Failed to save connections"));
          }
        }
        return true;
      } catch (error) {
        try {
          if (infos.length > 0) await note.undo();
        } catch (rollbackError) {
          console.error(
            "[whiteboard] failed to roll back extract notes",
            rollbackError,
          );
        }
        discardLastRecord(opts.boardBlockId);
        throw error;
      }
    },
    note,
  );

  if (!savedIncoming) return [];
  orca.notify("success", dropMessage(result));
  return result.incoming;
}

export async function completeExtractDrop(opts: {
  dataTransfer: DataTransfer | null;
  at: { x: number; y: number };
  existing: readonly WhiteboardCard[];
  existingEdges: readonly WhiteboardEdge[];
  boardBlockId: DbId;
  addCards: (cards: WhiteboardCard[]) => Promise<boolean>;
  commitEdges: (next: WhiteboardEdge[]) => Promise<boolean>;
}): Promise<WhiteboardCard[]> {
  const ids = parseDroppedBlockIds(opts.dataTransfer);
  if (ids.length === 0) return [];
  return extractBlocksToBoard({
    ids,
    sourceCardId: parseExtractSource(opts.dataTransfer),
    at: opts.at,
    existing: opts.existing,
    existingEdges: opts.existingEdges,
    boardBlockId: opts.boardBlockId,
    addCards: opts.addCards,
    commitEdges: opts.commitEdges,
  });
}
