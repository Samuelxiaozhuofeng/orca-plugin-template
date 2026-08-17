import type { Block, ContentFragment, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { getBoardSession } from "./boardSession";
import { BOARD_UNREADABLE_MSG } from "./boardWrite";
import { parseExtractSource } from "./cardExtract";
import {
  extractBlocksToBoard,
  resolveExtractSource,
} from "./cardExtractApply";
import type { WhiteboardCard } from "./cards";
import type { WhiteboardEdge } from "./edges";
import { blankCardAt, createdBlockFromResult, fetchBlock } from "./newCard";
import { createInlineRef, writeBlockContent } from "./noteWrite";
import {
  parseDroppedBlockIds,
  type RawContentFragment,
  rewriteFragmentsWithRefs,
} from "./pasteBlocks";

export async function insertTextBlockWithChildren(
  parentId: DbId,
  lines: readonly string[],
): Promise<Block> {
  if (lines.length === 0) {
    throw new Error("No lines to insert");
  }
  const [title, ...children] = lines;
  const parent = await fetchBlock(parentId);
  const siblingChildren = parent.children ?? [];
  const left =
    siblingChildren.length > 0
      ? siblingChildren[siblingChildren.length - 1]
      : null;

  const result = await orca.invokeBackend(
    "create-block",
    parentId,
    left,
    null,
    null,
    { type: "text" },
  );
  const rootBlock = createdBlockFromResult(result);
  const titleFragments: ContentFragment[] = [{ t: "t", v: title }];
  await writeBlockContent(rootBlock.id, titleFragments);

  let prevChildId: DbId | null = null;
  for (const childText of children) {
    const childResult = await orca.invokeBackend(
      "create-block",
      rootBlock.id,
      prevChildId,
      null,
      null,
      { type: "text" },
    );
    const childBlock = createdBlockFromResult(childResult);
    const childFragments: ContentFragment[] = [{ t: "t", v: childText }];
    await writeBlockContent(childBlock.id, childFragments);
    prevChildId = childBlock.id;
  }

  orca.broadcasts.broadcast("orca.refresh-blocks", [parentId, rootBlock.id]);
  return rootBlock;
}

export async function pasteTextToBoard(opts: {
  lines: readonly string[];
  at: { x: number; y: number };
  boardBlockId: DbId;
  addCards: (cards: WhiteboardCard[]) => Promise<boolean>;
}): Promise<WhiteboardCard | null> {
  if (opts.lines.length === 0) return null;

  if (getBoardSession(opts.boardBlockId)?.protect === true) {
    orca.notify("error", t(BOARD_UNREADABLE_MSG));
    return null;
  }

  const rootBlock = await insertTextBlockWithChildren(
    opts.boardBlockId,
    opts.lines,
  );
  const card = blankCardAt(rootBlock.id, opts.at.x, opts.at.y);
  const saved = await opts.addCards([card]);
  if (!saved) {
    orca.notify(
      "error",
      t(
        "Created the note but could not save it as a card. The new note is under this board in the outline.",
      ),
    );
    return null;
  }
  return card;
}

export async function pasteFragmentsToBoard(opts: {
  fragments: readonly RawContentFragment[];
  at: { x: number; y: number };
  boardBlockId: DbId;
  addCards: (cards: WhiteboardCard[]) => Promise<boolean>;
}): Promise<WhiteboardCard | null> {
  if (opts.fragments.length === 0) return null;

  if (getBoardSession(opts.boardBlockId)?.protect === true) {
    orca.notify("error", t(BOARD_UNREADABLE_MSG));
    return null;
  }

  const parent = await fetchBlock(opts.boardBlockId);
  const siblingChildren = parent.children ?? [];
  const left =
    siblingChildren.length > 0
      ? siblingChildren[siblingChildren.length - 1]
      : null;

  const result = await orca.invokeBackend(
    "create-block",
    opts.boardBlockId,
    left,
    null,
    null,
    { type: "text" },
  );
  const rootBlock = createdBlockFromResult(result);

  const processedFragments = await rewriteFragmentsWithRefs(
    opts.fragments,
    async (toId, alias) => {
      return createInlineRef(rootBlock.id, toId, alias);
    },
  );

  await writeBlockContent(rootBlock.id, processedFragments);
  orca.broadcasts.broadcast("orca.refresh-blocks", [
    opts.boardBlockId,
    rootBlock.id,
  ]);

  const card = blankCardAt(rootBlock.id, opts.at.x, opts.at.y);
  const saved = await opts.addCards([card]);
  if (!saved) {
    orca.notify(
      "error",
      t(
        "Created the note but could not save it as a card. The new note is under this board in the outline.",
      ),
    );
    return null;
  }
  return card;
}

export async function pasteBlocksToBoard(opts: {
  ids?: readonly DbId[];
  dataTransfer?: DataTransfer | null;
  at: { x: number; y: number };
  existing: readonly WhiteboardCard[];
  existingEdges: readonly WhiteboardEdge[];
  boardBlockId: DbId;
  addCards: (cards: WhiteboardCard[]) => Promise<boolean>;
  commitEdges: (next: WhiteboardEdge[]) => Promise<boolean>;
}): Promise<WhiteboardCard[]> {
  const ids = opts.ids ?? parseDroppedBlockIds(opts.dataTransfer);
  if (ids.length === 0) return [];
  const hinted = opts.dataTransfer
    ? parseExtractSource(opts.dataTransfer)
    : null;
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
