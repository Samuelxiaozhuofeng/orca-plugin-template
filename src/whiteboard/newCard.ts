import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { CARD_HEIGHT, CARD_WIDTH, type WhiteboardCard } from "./data";

function cacheBlock(item: unknown): Block | null {
  if (item == null || typeof item !== "object" || !("id" in item)) return null;
  const block = item as Block;
  if (typeof block.id !== "number") return null;
  orca.state.blocks[block.id] = block;
  return block;
}

export async function fetchBlock(id: DbId): Promise<Block> {
  const loaded = (await orca.invokeBackend("get-block", id)) as Block | null;
  const block = cacheBlock(loaded);
  if (block == null) {
    throw new Error(t("Failed to load this block"));
  }
  return block;
}

export function createdBlockFromResult(result: unknown): Block {
  const first = Array.isArray(result) ? result[0] : result;
  const block = cacheBlock(first);
  if (block == null) {
    throw new Error(t("Failed to create a new card"));
  }
  if (Array.isArray(result)) cacheBlockList(result[2]);
  return block;
}

/** Insert an empty text block as the last child of `parentId`. */
export async function insertLastChildTextBlock(parentId: DbId): Promise<Block> {
  const parent = await fetchBlock(parentId);
  const children = parent.children ?? [];
  const left = children.length > 0 ? children[children.length - 1] : null;
  const result = await orca.invokeBackend(
    "create-block",
    parentId,
    left,
    null,
    null,
    { type: "text" },
  );
  const created = createdBlockFromResult(result);
  orca.broadcasts.broadcast("orca.refresh-blocks", [parentId, created.id]);
  return created;
}

export function cacheBlockList(items: unknown): void {
  if (!Array.isArray(items)) return;
  for (const item of items) cacheBlock(item);
}

export function blankCardAt(
  blockId: DbId,
  x: number,
  y: number,
): WhiteboardCard {
  return {
    blockId,
    kind: "block",
    x,
    y,
    w: CARD_WIDTH,
    h: CARD_HEIGHT,
  };
}

export async function createBlankBoardCard(opts: {
  boardBlockId: DbId;
  x: number;
  y: number;
}): Promise<WhiteboardCard> {
  const created = await insertLastChildTextBlock(opts.boardBlockId);
  return blankCardAt(created.id, opts.x, opts.y);
}

export async function addBlankCardToBoard(opts: {
  boardBlockId: DbId;
  x: number;
  y: number;
  addCards: (cards: WhiteboardCard[]) => Promise<boolean>;
}): Promise<WhiteboardCard | null> {
  const card = await createBlankBoardCard({
    boardBlockId: opts.boardBlockId,
    x: opts.x,
    y: opts.y,
  });
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
