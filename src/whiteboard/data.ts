import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";

export const WHITEBOARD_TYPE = "whiteboard.canvas";
export const PANEL_TYPE = "whiteboard.board";

export {
  CARD_HEIGHT,
  CARD_WIDTH,
  GRID_GAP,
  GRID_ORIGIN,
  MAX_RANGE_DAYS,
  MAX_SCALE,
  MIN_CARD_HEIGHT,
  MIN_CARD_WIDTH,
  MIN_GRID_COLUMNS,
  MAX_GRID_COLUMNS,
  MIN_SCALE,
  WEEKDAY_HEADER_H,
  WEEKDAY_LABELS_MON,
  cardDateMeta,
  clampCardSize,
  clampGridColumns,
  clampScale,
  columnCount,
  defaultGridColumns,
  formatCardTitle,
  formatDateKey,
  inclusiveDayCount,
  last7Days,
  matchingPreset,
  normalizeRange,
  rangeFromPreset,
  startOfLocalDay,
  utcMidnightMs,
  viewportOrigin,
  type CanvasOrigin,
  type DateRange,
  type LayoutMode,
  type RangePreset,
} from "./layout";

export {
  cardsEqual,
  normalizeCard,
  parseCards,
  readCards,
  writeCards,
  type WhiteboardCard,
} from "./cards";

export {
  edgesEqual,
  normalizeEdge,
  parseEdges,
  readEdges,
  sanitizeEdges,
  writeEdges,
  type EdgeArrow,
  type Side,
  type WhiteboardEdge,
} from "./edges";

export {
  fetchJournalBlocks,
  journalDateKey,
  journalHasContent,
  placeJournalCards,
  type PlaceRequest,
  type PlaceResult,
} from "./journals";

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

export function insertedBlockId(result: unknown): DbId | null {
  const direct = asBlockId(result);
  if (direct != null) return direct;
  if (result != null && typeof result === "object" && "id" in result) {
    return asBlockId((result as { id: unknown }).id);
  }
  return null;
}
