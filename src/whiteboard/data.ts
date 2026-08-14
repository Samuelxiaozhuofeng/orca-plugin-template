import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";

export const WHITEBOARD_TYPE = "whiteboard.canvas";
export const PANEL_TYPE = "whiteboard.board";
export const CARDS_PROP = "cards";
export const PROP_TYPE_TEXT = 1;
export const CARD_WIDTH = 260;
export const CARD_HEIGHT = 200;
export const GRID_GAP = 16;
export const GRID_ORIGIN = 24;
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 2;

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export type WhiteboardCard = {
  blockId: DbId;
  date: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatCardTitle(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map((part) => Number(part));
  if (!y || !m || !d) return dateKey;
  const date = new Date(y, m - 1, d);
  return `${dateKey} ${WEEKDAYS[date.getDay()]}`;
}

/** Today and the 6 local days before it, oldest first. */
export function last7Days(now: Date = new Date()): Date[] {
  const today = startOfLocalDay(now);
  const days: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    days.push(
      new Date(today.getFullYear(), today.getMonth(), today.getDate() - i),
    );
  }
  return days;
}

export function utcMidnightMs(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function columnCount(viewportWidth: number): number {
  return Math.max(
    1,
    Math.floor((viewportWidth + GRID_GAP) / (CARD_WIDTH + GRID_GAP)),
  );
}

export function layoutGrid(
  index: number,
  cols: number,
): { x: number; y: number } {
  const safeCols = Math.max(1, cols);
  const col = index % safeCols;
  const row = Math.floor(index / safeCols);
  return {
    x: GRID_ORIGIN + col * (CARD_WIDTH + GRID_GAP),
    y: GRID_ORIGIN + row * (CARD_HEIGHT + GRID_GAP),
  };
}

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function isCard(value: unknown): value is WhiteboardCard {
  if (value == null || typeof value !== "object") return false;
  const card = value as Record<string, unknown>;
  return (
    typeof card.blockId === "number" &&
    typeof card.date === "string" &&
    typeof card.x === "number" &&
    typeof card.y === "number" &&
    typeof card.w === "number" &&
    typeof card.h === "number"
  );
}

function parseCardsValue(value: unknown): WhiteboardCard[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return [];
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isCard);
}

export function readCards(
  block:
    | { properties?: readonly { name: string; value?: unknown }[] }
    | undefined,
): WhiteboardCard[] {
  if (block == null) return [];
  const prop = block.properties?.find((item) => item.name === CARDS_PROP);
  if (prop == null) return [];
  return parseCardsValue(prop.value);
}

function applyReturnedBlocks(result: unknown): void {
  const blocks = Array.isArray(result)
    ? Array.isArray(result[1])
      ? result[1]
      : result
    : [];
  for (const item of blocks) {
    if (item != null && typeof item === "object" && "id" in item) {
      const block = item as Block;
      if (typeof block.id === "number") {
        orca.state.blocks[block.id] = block;
      }
    }
  }
}

function cardsEqual(left: WhiteboardCard[], right: WhiteboardCard[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function writeCards(
  blockId: DbId,
  cards: WhiteboardCard[],
): Promise<void> {
  const payload = JSON.stringify(cards);
  // Must not use invokeEditorCommand here: that API no-ops when the active
  // panel has no viewState.editor (the whiteboard panel never has one).
  const result = await orca.invokeBackend(
    "set-properties",
    [blockId],
    [
      {
        name: CARDS_PROP,
        type: PROP_TYPE_TEXT,
        value: payload,
      },
    ],
  );
  applyReturnedBlocks(result);

  const fresh = (await orca.invokeBackend("get-block", blockId)) as
    | Block
    | null;
  if (fresh != null && typeof fresh.id === "number") {
    orca.state.blocks[fresh.id] = fresh;
  }

  const readBack = readCards(fresh ?? orca.state.blocks[blockId]);
  if (!cardsEqual(readBack, cards)) {
    console.error("[whiteboard] cards write verify failed", {
      blockId,
      expected: cards,
      readBack,
      backendResult: result,
      freshProperties: fresh?.properties,
    });
    throw new Error(t("Whiteboard cards were not saved"));
  }

  orca.broadcasts.broadcast("orca.refresh-blocks", [blockId]);
}

export function boardName(
  block: { aliases?: string[]; text?: string } | undefined,
): string {
  const alias = block?.aliases?.[0];
  if (typeof alias === "string" && alias.trim()) return alias.trim();
  const text = typeof block?.text === "string" ? block.text.trim() : "";
  if (text) return text;
  return t("Whiteboard");
}

export function openBoard(
  blockId: DbId,
  panelId: string,
  newPanel: boolean,
): void {
  const viewArgs = { blockId };
  if (newPanel) {
    const created = orca.nav.addTo(panelId, "right", {
      view: PANEL_TYPE,
      viewArgs,
      viewState: {},
    });
    if (created) {
      orca.nav.switchFocusTo(created);
      return;
    }
    orca.notify("error", t("Failed to open whiteboard panel"));
    return;
  }
  orca.nav.goTo(PANEL_TYPE, viewArgs, panelId);
}

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

function journalDateKey(block: Block | undefined): string | null {
  if (block == null) return null;
  const repr = block.properties?.find((item) => item.name === "_repr")?.value;
  if (repr == null || typeof repr !== "object") return null;
  const raw = (repr as { date?: unknown }).date;
  if (raw == null) return null;
  const date = raw instanceof Date ? raw : new Date(raw as string | number);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function cacheBlocks(blocks: Block[]): void {
  for (const block of blocks) {
    orca.state.blocks[block.id] = block;
  }
}

export async function fetchWeekJournalCards(
  existing: WhiteboardCard[],
  viewportWidth: number,
): Promise<WhiteboardCard[]> {
  const week = last7Days();
  const allowed = new Set(week.map(formatDateKey));
  const startMs = utcMidnightMs(week[0]);
  const endMs = utcMidnightMs(week[week.length - 1]);

  const result = await orca.invokeBackend("query", {
    q: {
      kind: 1,
      conditions: [
        {
          kind: 3,
          start: { t: 2, v: startMs },
          end: { t: 2, v: endMs },
        },
      ],
    },
    pageSize: 50,
  });

  console.info("[whiteboard] query journals", {
    rawType: Array.isArray(result) ? `array(${result.length})` : typeof result,
    sample: Array.isArray(result) ? result[0] : result,
  });

  const ids = collectIds(result);
  const fetched: Block[] =
    ids.length === 0
      ? []
      : ((await orca.invokeBackend("get-blocks", ids)) as Block[] | null) ?? [];
  if (!Array.isArray(fetched)) {
    throw new Error("get-blocks did not return an array");
  }
  cacheBlocks(fetched);

  const byDate = new Map(existing.map((card) => [card.date, card]));
  const next = [...existing];
  const cols = columnCount(viewportWidth);
  let slot = existing.length;

  const ordered = [...fetched].sort((a, b) => {
    const da = journalDateKey(a) ?? "";
    const db = journalDateKey(b) ?? "";
    return da.localeCompare(db);
  });

  for (const block of ordered) {
    const dateKey = journalDateKey(block);
    if (dateKey == null || !allowed.has(dateKey) || byDate.has(dateKey)) {
      continue;
    }
    const pos = layoutGrid(slot, cols);
    const card: WhiteboardCard = {
      blockId: block.id,
      date: dateKey,
      x: pos.x,
      y: pos.y,
      w: CARD_WIDTH,
      h: CARD_HEIGHT,
    };
    byDate.set(dateKey, card);
    next.push(card);
    slot += 1;
  }

  return next;
}

export function insertedBlockId(result: unknown): DbId | null {
  const direct = asBlockId(result);
  if (direct != null) return direct;
  if (result != null && typeof result === "object" && "id" in result) {
    return asBlockId((result as { id: unknown }).id);
  }
  return null;
}
