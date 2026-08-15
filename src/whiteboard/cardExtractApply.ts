import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { discardLastRecord, runAsHistoryStep } from "./boardHistory";
import { getBoardSession } from "./boardSession";
import { BOARD_UNREADABLE_MSG } from "./boardWrite";
import type { WhiteboardCard } from "./cards";
import {
  findOwningCardId,
  findVacantCardPosition,
  parseExtractSource,
  planExtractEdge,
  planExtractMoves,
} from "./cardExtract";
import { type ExtractRestoreInfo } from "./cardExtractModel";
import { moveBlockOutAsExtract } from "./cardExtractMove";
import { makeExtractNoteAction } from "./cardExtractRestore";
import {
  dropMessage,
  parseDroppedBlockIds,
  placeDroppedBlocks,
  type DropBlocksResult,
} from "./dropBlocks";
import type { WhiteboardEdge } from "./edges";
import { fetchBlock } from "./newCard";

const ANCESTOR_WALK_MAX = 40;

const EXTRACT_MOVED_MSG =
  "Original notes were moved onto the whiteboard. References were left in their place.";

function extractDropMessage(
  result: DropBlocksResult,
  movedCount: number,
): string {
  if (movedCount <= 0) return dropMessage(result);
  const moved = t(EXTRACT_MOVED_MSG);
  if (result.added > 0) {
    return `${dropMessage(result)}${t(", ")}${moved}`;
  }
  return moved;
}

function createExtractRollback(note: { undo: () => Promise<void> }): {
  run: (moved: boolean) => Promise<void>;
} {
  let attempted = false;
  return {
    run: async (moved: boolean) => {
      if (attempted) return;
      attempted = true;
      if (!moved) return;
      try {
        await note.undo();
      } catch (rollbackError) {
        console.error(
          "[whiteboard] failed to roll back extract notes",
          rollbackError,
        );
        throw rollbackError;
      }
    },
  };
}

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

  await ensureParentChainCached(opts.ids);
  const cardIds = new Set(opts.existing.map((card) => card.blockId));
  const movingIds = planExtractMoves(
    opts.ids,
    opts.boardBlockId,
    orca.state.blocks,
    cardIds,
    opts.sourceCardId,
  );
  if (result.incoming.length === 0 && movingIds.length === 0) {
    orca.notify("info", dropMessage(result));
    return [];
  }

  if (getBoardSession(opts.boardBlockId)?.protect === true) {
    orca.notify("error", t(BOARD_UNREADABLE_MSG));
    return [];
  }

  const incomingIds = new Set(result.incoming.map((card) => card.blockId));
  const edgeTargets = [
    ...result.incoming,
    ...movingIds
      .filter((blockId) => !incomingIds.has(blockId))
      .map((blockId) => ({ blockId })),
  ];
  const edgesToAdd: WhiteboardEdge[] = [];
  if (opts.sourceCardId != null) {
    let planned: WhiteboardEdge[] = [...opts.existingEdges];
    for (const card of edgeTargets) {
      const edge = planExtractEdge(opts.sourceCardId, card.blockId, planned);
      if (edge == null) continue;
      edgesToAdd.push(edge);
      planned = [...planned, edge];
    }
  }

  const infos: ExtractRestoreInfo[] = [];
  const note = makeExtractNoteAction(infos);
  const rollback = createExtractRollback(note);

  const savedIncoming = await runAsHistoryStep(
    opts.boardBlockId,
    { cards: [...opts.existing], edges: [...opts.existingEdges] },
    async () => {
      try {
        for (const blockId of movingIds) {
          const sourceCardId =
            opts.sourceCardId ?? (await loadOwningCardId(blockId, cardIds));
          infos.push(
            await moveBlockOutAsExtract({
              blockId,
              sourceCardId,
              boardBlockId: opts.boardBlockId,
            }),
          );
        }
        if (result.incoming.length > 0) {
          const saved = await opts.addCards(result.incoming);
          if (!saved) {
            await rollback.run(infos.length > 0);
            discardLastRecord(opts.boardBlockId);
            return false;
          }
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
          await rollback.run(infos.length > 0);
        } catch (rollbackError) {
          discardLastRecord(opts.boardBlockId);
          throw rollbackError;
        }
        discardLastRecord(opts.boardBlockId);
        throw error;
      }
    },
    note,
  );

  if (!savedIncoming) return [];
  orca.notify("success", extractDropMessage(result, infos.length));
  return result.incoming;
}

async function ensureParentChainCached(ids: readonly DbId[]): Promise<void> {
  for (const id of ids) {
    let currentId: DbId | null = id;
    const seen = new Set<DbId>();
    for (let i = 0; i < ANCESTOR_WALK_MAX; i++) {
      if (currentId == null || seen.has(currentId)) break;
      seen.add(currentId);
      let block = orca.state.blocks[currentId] as
        | { parent?: DbId | null }
        | undefined;
      if (block == null) {
        try {
          block = await fetchBlock(currentId);
        } catch {
          break;
        }
      }
      const parent = block.parent;
      currentId =
        typeof parent === "number" && Number.isFinite(parent) ? parent : null;
    }
  }
}

async function loadOwningCardId(
  blockId: DbId,
  cardIds: ReadonlySet<DbId>,
): Promise<DbId | null> {
  const cached = findOwningCardId(blockId, cardIds, orca.state.blocks);
  if (cached != null) return cached;
  let currentId: DbId | null = blockId;
  const seen = new Set<DbId>();
  for (let i = 0; i < ANCESTOR_WALK_MAX; i++) {
    if (currentId == null || seen.has(currentId)) break;
    seen.add(currentId);
    let block = orca.state.blocks[currentId] as
      | { parent?: DbId | null }
      | undefined;
    if (block == null) {
      try {
        block = await fetchBlock(currentId);
      } catch {
        break;
      }
    }
    const parent =
      typeof block.parent === "number" && Number.isFinite(block.parent)
        ? block.parent
        : null;
    if (parent == null) break;
    if (cardIds.has(parent)) return parent;
    currentId = parent;
  }
  return findOwningCardId(blockId, cardIds, orca.state.blocks);
}

export async function resolveExtractSource(
  ids: readonly DbId[],
  cards: readonly { blockId: DbId }[],
  hinted: DbId | null,
): Promise<DbId | null> {
  const cardIds = new Set(cards.map((card) => card.blockId));
  if (hinted != null && cardIds.has(hinted)) return hinted;
  for (const id of ids) {
    const found = await loadOwningCardId(id, cardIds);
    if (found != null) return found;
  }
  return null;
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
  const hinted = parseExtractSource(opts.dataTransfer);
  const sourceCardId = await resolveExtractSource(ids, opts.existing, hinted);
  return extractBlocksToBoard({
    ids,
    sourceCardId,
    at: opts.at,
    existing: opts.existing,
    existingEdges: opts.existingEdges,
    boardBlockId: opts.boardBlockId,
    addCards: opts.addCards,
    commitEdges: opts.commitEdges,
  });
}

export async function completeCanvasDrop(opts: {
  dataTransfer: DataTransfer | null;
  at: { x: number; y: number };
  existing: readonly WhiteboardCard[];
  existingEdges: readonly WhiteboardEdge[];
  boardBlockId: DbId;
  addCards: (cards: WhiteboardCard[]) => Promise<boolean>;
  commitEdges: (next: WhiteboardEdge[]) => Promise<boolean>;
}): Promise<WhiteboardCard[]> {
  return completeExtractDrop(opts);
}
