import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import type { WhiteboardCard } from "./cards";
import { journalDateKey } from "./journals";
import { CARD_HEIGHT, CARD_WIDTH, GRID_GAP } from "./layout";

const DROP_COLUMNS = 4;

export type DropBlocksResult = {
  cards: WhiteboardCard[];
  incoming: WhiteboardCard[];
  added: number;
  skippedExisting: number;
  skippedSelf: number;
};

export function orcaBlockMime(): string {
  return `orca/${encodeURIComponent(orca.state.repo).toLowerCase()}`;
}

export function isOrcaBlockDrag(
  dataTransfer: DataTransfer | null | undefined,
): boolean {
  if (dataTransfer == null) return false;
  return Array.from(dataTransfer.types).includes(orcaBlockMime());
}

export function parseDroppedBlockIds(
  dataTransfer: DataTransfer | null | undefined,
): DbId[] {
  if (dataTransfer == null) return [];
  const raw = dataTransfer.getData(orcaBlockMime());
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (parsed == null || typeof parsed !== "object") return [];
  if ("highlight" in parsed) return [];
  const blocks = (parsed as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks)) return [];
  const ids: DbId[] = [];
  for (const item of blocks) {
    if (typeof item === "number" && Number.isFinite(item)) ids.push(item);
  }
  return ids;
}

export function isLeavingDragTarget(
  currentTarget: EventTarget,
  relatedTarget: EventTarget | null,
): boolean {
  if (!(currentTarget instanceof Element)) return true;
  return !(
    relatedTarget instanceof Node && currentTarget.contains(relatedTarget)
  );
}

function cacheBlocks(blocks: Block[]): void {
  for (const block of blocks) {
    orca.state.blocks[block.id] = block;
  }
}

export async function ensureBlocksCached(ids: DbId[]): Promise<void> {
  const missing = ids.filter((id) => orca.state.blocks[id] == null);
  if (missing.length === 0) return;
  const fetched =
    ((await orca.invokeBackend("get-blocks", missing)) as Block[] | null) ?? [];
  if (!Array.isArray(fetched)) {
    throw new Error("get-blocks did not return an array");
  }
  cacheBlocks(fetched);
}

function cardFromBlock(
  blockId: DbId,
  x: number,
  y: number,
  blocks: { [id: number]: Block | undefined },
): WhiteboardCard {
  const date = journalDateKey(blocks[blockId]);
  if (date != null) {
    return {
      blockId,
      kind: "journal",
      date,
      x,
      y,
      w: CARD_WIDTH,
      h: CARD_HEIGHT,
    };
  }
  return {
    blockId,
    kind: "block",
    x,
    y,
    w: CARD_WIDTH,
    h: CARD_HEIGHT,
  };
}

export function planDroppedCards(opts: {
  ids: readonly DbId[];
  at: { x: number; y: number };
  existing: readonly WhiteboardCard[];
  boardBlockId: DbId;
  blocks: { [id: number]: Block | undefined };
}): DropBlocksResult {
  const occupied = new Set(opts.existing.map((card) => card.blockId));
  let skippedExisting = 0;
  let skippedSelf = 0;
  const incoming: WhiteboardCard[] = [];

  for (const id of opts.ids) {
    if (id === opts.boardBlockId) {
      skippedSelf += 1;
      continue;
    }
    if (occupied.has(id)) {
      skippedExisting += 1;
      continue;
    }
    occupied.add(id);
    const index = incoming.length;
    const col = index % DROP_COLUMNS;
    const row = Math.floor(index / DROP_COLUMNS);
    incoming.push(
      cardFromBlock(
        id,
        opts.at.x + col * (CARD_WIDTH + GRID_GAP),
        opts.at.y + row * (CARD_HEIGHT + GRID_GAP),
        opts.blocks,
      ),
    );
  }

  return {
    cards: [...opts.existing, ...incoming],
    incoming,
    added: incoming.length,
    skippedExisting,
    skippedSelf,
  };
}

export async function placeDroppedBlocks(opts: {
  ids: readonly DbId[];
  at: { x: number; y: number };
  existing: readonly WhiteboardCard[];
  boardBlockId: DbId;
}): Promise<DropBlocksResult> {
  await ensureBlocksCached([...opts.ids]);
  return planDroppedCards({
    ids: opts.ids,
    at: opts.at,
    existing: opts.existing,
    boardBlockId: opts.boardBlockId,
    blocks: orca.state.blocks,
  });
}

/** Only mentions the counts that actually happened, so the common
 * "dropped one new block" case reads as a single short sentence. */
function dropMessage(result: DropBlocksResult): string {
  const parts: string[] = [];
  if (result.added > 0) {
    parts.push(t("Added ${added} cards", { added: String(result.added) }));
  }
  if (result.skippedExisting > 0) {
    parts.push(
      t("skipped ${existing} already on the board", {
        existing: String(result.skippedExisting),
      }),
    );
  }
  if (result.skippedSelf > 0) {
    parts.push(
      t("skipped ${self} that would nest this board", {
        self: String(result.skippedSelf),
      }),
    );
  }
  if (parts.length === 0) return t("Nothing to add to the board");
  return parts.join(t(", "));
}

export async function completeBoardDrop(opts: {
  dataTransfer: DataTransfer | null;
  at: { x: number; y: number };
  existing: readonly WhiteboardCard[];
  boardBlockId: DbId;
  addCards: (cards: WhiteboardCard[]) => Promise<boolean>;
}): Promise<void> {
  const ids = parseDroppedBlockIds(opts.dataTransfer);
  if (ids.length === 0) return;
  const result = await placeDroppedBlocks({
    ids,
    at: opts.at,
    existing: opts.existing,
    boardBlockId: opts.boardBlockId,
  });
  if (result.added > 0) {
    const saved = await opts.addCards(result.incoming);
    if (!saved) return;
  }
  orca.notify(result.added > 0 ? "success" : "info", dropMessage(result));
}
