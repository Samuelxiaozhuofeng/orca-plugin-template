import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  type CanvasOrigin,
  type DateRange,
  type LayoutMode,
  MAX_RANGE_DAYS,
  formatDateKey,
  inclusiveDayCount,
  layoutCalendarCell,
  layoutGrid,
  normalizeRange,
  parseDateKey,
  utcMidnightMs,
} from "./layout";
import type { WhiteboardCard } from "./cards";

export type PlaceRequest = {
  start: Date;
  end: Date;
  layout: LayoutMode;
  columns: number;
  onlyWithContent: boolean;
  origin: CanvasOrigin;
  existing: WhiteboardCard[];
};

export type PlaceResult = {
  cards: WhiteboardCard[];
  placed: number;
  skippedExisting: number;
  skippedEmpty: number;
};

function asBlockId(value: unknown): DbId | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function collectIds(result: unknown): DbId[] {
  if (!Array.isArray(result)) return [];
  const ids: DbId[] = [];
  for (const item of result) {
    if (typeof item === "number") {
      const id = asBlockId(item);
      if (id != null) ids.push(id);
      continue;
    }
    if (item != null && typeof item === "object" && "id" in item) {
      const id = asBlockId((item as { id: unknown }).id);
      if (id != null) ids.push(id);
    }
  }
  return ids;
}

export function journalDateKey(block: Block | undefined): string | null {
  if (block == null) return null;
  const repr = block.properties?.find((item) => item.name === "_repr")?.value;
  if (repr == null || typeof repr !== "object") return null;
  const raw = (repr as { date?: unknown }).date;
  if (raw == null) return null;
  const date = raw instanceof Date ? raw : new Date(raw as string | number);
  if (Number.isNaN(date.getTime())) return null;
  return formatDateKey(date);
}

/** Same empty rule as Card: no trimmed text and no children. */
export function journalHasContent(block: Block): boolean {
  const text = typeof block.text === "string" ? block.text.trim() : "";
  if (text.length > 0) return true;
  return (block.children?.length ?? 0) > 0;
}

function cacheBlocks(blocks: Block[]): void {
  for (const block of blocks) {
    orca.state.blocks[block.id] = block;
  }
}

export async function fetchJournalBlocks(range: DateRange): Promise<Block[]> {
  const { start, end } = normalizeRange(range.start, range.end);
  const result = await orca.invokeBackend("query", {
    q: {
      kind: 1,
      conditions: [
        {
          kind: 3,
          start: { t: 2, v: utcMidnightMs(start) },
          end: { t: 2, v: utcMidnightMs(end) },
        },
      ],
    },
    pageSize: 200,
  });

  const ids = collectIds(result);
  const fetched: Block[] =
    ids.length === 0
      ? []
      : ((await orca.invokeBackend("get-blocks", ids)) as Block[] | null) ?? [];
  if (!Array.isArray(fetched)) {
    console.error("[whiteboard] get-blocks did not return an array", fetched);
    throw new Error(t("Failed to load journals"));
  }
  cacheBlocks(fetched);
  return fetched;
}

export async function placeJournalCards(
  request: PlaceRequest,
): Promise<PlaceResult> {
  const range = normalizeRange(request.start, request.end);
  if (inclusiveDayCount(range.start, range.end) > MAX_RANGE_DAYS) {
    throw new Error(t("Range is limited to 92 days"));
  }

  const allowed = new Set<string>();
  const dayCount = inclusiveDayCount(range.start, range.end);
  for (let i = 0; i < dayCount; i++) {
    const date = new Date(
      range.start.getFullYear(),
      range.start.getMonth(),
      range.start.getDate() + i,
    );
    allowed.add(formatDateKey(date));
  }

  const fetched = await fetchJournalBlocks(range);
  const existingIds = new Set(
    request.existing.map((card) => card.blockId),
  );
  const byDate = new Map<string, WhiteboardCard>();
  for (const card of request.existing) {
    if (card.kind === "journal" && typeof card.date === "string") {
      byDate.set(card.date, card);
    }
  }
  const seen = new Set<string>();
  let skippedExisting = 0;
  let skippedEmpty = 0;
  const incoming: { date: string; block: Block }[] = [];

  for (const block of fetched) {
    const dateKey = journalDateKey(block);
    if (dateKey == null || !allowed.has(dateKey) || seen.has(dateKey)) {
      continue;
    }
    seen.add(dateKey);
    if (byDate.has(dateKey) || existingIds.has(block.id)) {
      skippedExisting += 1;
      continue;
    }
    if (request.onlyWithContent && !journalHasContent(block)) {
      skippedEmpty += 1;
      continue;
    }
    incoming.push({ date: dateKey, block });
  }

  incoming.sort((a, b) => a.date.localeCompare(b.date));

  const next = [...request.existing];
  incoming.forEach((item, index) => {
    const date = parseDateKey(item.date);
    const pos =
      request.layout === "calendar" && date != null
        ? layoutCalendarCell(date, range.start, request.origin)
        : layoutGrid(index, request.columns, request.origin);
    const card: WhiteboardCard = {
      blockId: item.block.id,
      kind: "journal",
      date: item.date,
      x: pos.x,
      y: pos.y,
      w: CARD_WIDTH,
      h: CARD_HEIGHT,
    };
    next.push(card);
  });

  return {
    cards: next,
    placed: incoming.length,
    skippedExisting,
    skippedEmpty,
  };
}
