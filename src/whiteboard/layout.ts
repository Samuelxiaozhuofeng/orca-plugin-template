export const CARD_WIDTH = 340;
export const CARD_HEIGHT = 200;
export const MIN_CARD_WIDTH = 160;
export const MIN_CARD_HEIGHT = 120;
export const GRID_GAP = 16;
export const GRID_ORIGIN = 24;
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 2;
/** Below this zoom, cards paint as a title chip (no hosted block tree). */
export const CARD_LOD_SCALE = 0.5;
/** Max Card components mounted at once, even when more sit in the cull window. */
export const CARD_MOUNT_CAP = 300;
export const MAX_RANGE_DAYS = 92;
export const MIN_GRID_COLUMNS = 1;
export const MAX_GRID_COLUMNS = 14;
export const WEEKDAY_HEADER_H = 22;

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
export const WEEKDAY_LABELS_MON = [
  "周一",
  "周二",
  "周三",
  "周四",
  "周五",
  "周六",
  "周日",
];

export type DateRange = { start: Date; end: Date };
export type LayoutMode = "calendar" | "grid";
export type CanvasOrigin = { x: number; y: number };
export type RangePreset =
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "last7"
  | "last30";

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addLocalDays(date: Date, days: number): Date {
  const local = startOfLocalDay(date);
  return new Date(local.getFullYear(), local.getMonth(), local.getDate() + days);
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(dateKey: string): Date | null {
  const [y, m, d] = dateKey.split("-").map((part) => Number(part));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function utcMidnightMs(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function mondayOf(date: Date): Date {
  const local = startOfLocalDay(date);
  const day = local.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addLocalDays(local, offset);
}

export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function normalizeRange(start: Date, end: Date): DateRange {
  const a = startOfLocalDay(start);
  const b = startOfLocalDay(end);
  if (utcMidnightMs(a) <= utcMidnightMs(b)) return { start: a, end: b };
  return { start: b, end: a };
}

export function inclusiveDayCount(start: Date, end: Date): number {
  const range = normalizeRange(start, end);
  return (
    Math.round(
      (utcMidnightMs(range.end) - utcMidnightMs(range.start)) / 86_400_000,
    ) + 1
  );
}

export function rangeFromPreset(
  preset: RangePreset,
  now: Date = new Date(),
): DateRange {
  const today = startOfLocalDay(now);
  if (preset === "thisWeek") {
    const start = mondayOf(today);
    return { start, end: addLocalDays(start, 6) };
  }
  if (preset === "lastWeek") {
    const start = addLocalDays(mondayOf(today), -7);
    return { start, end: addLocalDays(start, 6) };
  }
  if (preset === "thisMonth") {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: new Date(today.getFullYear(), today.getMonth() + 1, 0),
    };
  }
  if (preset === "lastMonth") {
    return {
      start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      end: new Date(today.getFullYear(), today.getMonth(), 0),
    };
  }
  if (preset === "last30") {
    return { start: addLocalDays(today, -29), end: today };
  }
  return { start: addLocalDays(today, -6), end: today };
}

export function matchingPreset(range: DateRange): RangePreset | null {
  const presets: RangePreset[] = [
    "thisWeek",
    "lastWeek",
    "thisMonth",
    "lastMonth",
    "last7",
    "last30",
  ];
  const startKey = formatDateKey(range.start);
  const endKey = formatDateKey(range.end);
  for (const preset of presets) {
    const next = rangeFromPreset(preset);
    if (
      formatDateKey(next.start) === startKey &&
      formatDateKey(next.end) === endKey
    ) {
      return preset;
    }
  }
  return null;
}

export function formatCardTitle(dateKey: string): string {
  const meta = cardDateMeta(dateKey);
  return `${meta.date} ${meta.weekday}`.trim();
}

export function cardDateMeta(dateKey: string): {
  date: string;
  weekday: string;
  isToday: boolean;
  isWeekend: boolean;
} {
  const date = parseDateKey(dateKey);
  if (date == null) {
    return { date: dateKey, weekday: "", isToday: false, isWeekend: false };
  }
  return {
    date: dateKey,
    weekday: WEEKDAYS[date.getDay()] ?? "",
    isToday: dateKey === formatDateKey(new Date()),
    isWeekend: date.getDay() === 0 || date.getDay() === 6,
  };
}

export function last7Days(now: Date = new Date()): Date[] {
  const range = rangeFromPreset("last7", now);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) days.push(addLocalDays(range.start, i));
  return days;
}

export function columnCount(viewportWidth: number): number {
  return Math.max(
    1,
    Math.floor((viewportWidth + GRID_GAP) / (CARD_WIDTH + GRID_GAP)),
  );
}

export function defaultGridColumns(viewportWidth: number): number {
  return Math.min(
    MAX_GRID_COLUMNS,
    Math.max(MIN_GRID_COLUMNS, columnCount(viewportWidth)),
  );
}

export function layoutGrid(
  index: number,
  cols: number,
  origin: CanvasOrigin = { x: GRID_ORIGIN, y: GRID_ORIGIN },
): { x: number; y: number } {
  const safeCols = Math.max(1, cols);
  const col = index % safeCols;
  const row = Math.floor(index / safeCols);
  return {
    x: origin.x + col * (CARD_WIDTH + GRID_GAP),
    y: origin.y + row * (CARD_HEIGHT + GRID_GAP),
  };
}

export function calendarCell(
  date: Date,
  rangeStart: Date,
): { col: number; row: number } {
  const start = startOfLocalDay(rangeStart);
  const day = startOfLocalDay(date);
  const offsetDays = Math.round(
    (utcMidnightMs(day) - utcMidnightMs(start)) / 86_400_000,
  );
  const index = mondayIndex(start) + offsetDays;
  return { col: index % 7, row: Math.floor(index / 7) };
}

export function layoutCalendarCell(
  date: Date,
  rangeStart: Date,
  origin: CanvasOrigin,
): { x: number; y: number } {
  const { col, row } = calendarCell(date, rangeStart);
  return {
    x: origin.x + col * (CARD_WIDTH + GRID_GAP),
    y: origin.y + row * (CARD_HEIGHT + GRID_GAP),
  };
}

export function viewportOrigin(view: {
  x: number;
  y: number;
  scale: number;
}): CanvasOrigin {
  const scale = view.scale === 0 ? 1 : view.scale;
  return {
    x: -view.x / scale + GRID_ORIGIN,
    y: -view.y / scale + GRID_ORIGIN,
  };
}

export function weekdayGuideAt(origin: CanvasOrigin): CanvasOrigin {
  return { x: origin.x, y: origin.y - WEEKDAY_HEADER_H };
}

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function clampCardSize(
  width: number,
  height: number,
): { w: number; h: number } {
  return {
    w: Math.max(MIN_CARD_WIDTH, width),
    h: Math.max(MIN_CARD_HEIGHT, height),
  };
}

export function clampGridColumns(value: number): number {
  return Math.min(
    MAX_GRID_COLUMNS,
    Math.max(MIN_GRID_COLUMNS, Math.round(value)),
  );
}
