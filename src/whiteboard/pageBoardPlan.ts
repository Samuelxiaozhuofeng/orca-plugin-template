import type { DbId } from "../orca.d.ts";
import type { WhiteboardCard } from "./cards.ts";
import { CARD_HEIGHT, CARD_WIDTH, GRID_ORIGIN, layoutGrid } from "./layout.ts";

const WHITEBOARD_TYPE = "whiteboard.canvas";

/** Matches drop/tag placement: four cards per row. */
export const PAGE_BOARD_COLUMNS = 4;

export const REPR_PROP = "_repr";

/**
 * Hidden identity for a page whiteboard. Not `_`-prefixed: host reserved
 * names start with `_` (plugin-docs/documents/Quick-Start.md).
 */
export const WHITEBOARD_PAGE_PROP = "whiteboardPage";

export type BlockPropsLike =
  | { properties?: readonly { name: string; value?: unknown }[] }
  | null
  | undefined;

export function asBlockId(value: unknown): DbId | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

export function numberedAlias(base: string, index: number): string {
  return index <= 1 ? base : `${base} ${index}`;
}

export function normalizePageName(raw: string): string {
  return raw.trim();
}

export function isBlankPageName(raw: string): boolean {
  return normalizePageName(raw) === "";
}

/** Exact match after trim. User-chosen names are not auto-numbered. */
export function isPageAliasTaken(
  name: string,
  existing: ReadonlySet<string>,
): boolean {
  return existing.has(normalizePageName(name));
}

/**
 * System default names may carry a suffix (`Name`, `Name 2`, …).
 * Returns null when every attempt is already taken.
 */
export function nextFreeNumberedAlias(
  base: string,
  existing: ReadonlySet<string>,
  maxAttempts: number,
): string | null {
  const stem = normalizePageName(base) || base;
  if (maxAttempts <= 0) return null;
  for (let i = 1; i <= maxAttempts; i++) {
    const candidate = numberedAlias(stem, i);
    if (!existing.has(candidate)) return candidate;
  }
  return null;
}

export function reprType(block: BlockPropsLike): string | null {
  const repr = block?.properties?.find((item) => item.name === REPR_PROP)?.value;
  if (repr == null || typeof repr !== "object") return null;
  const type = (repr as { type?: unknown }).type;
  return typeof type === "string" ? type : null;
}

/** Host stores PropType.Boolean as 0/1 (asar setProperties). */
export function isTruthyFlagValue(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }
  return false;
}

export function isInlineWhiteboardBlock(block: BlockPropsLike): boolean {
  return reprType(block) === WHITEBOARD_TYPE;
}

/** Page whiteboard = the marker property is present and true. */
export function isPageWhiteboardBlock(block: BlockPropsLike): boolean {
  const prop = block?.properties?.find(
    (item) => item.name === WHITEBOARD_PAGE_PROP,
  );
  if (prop == null) return false;
  return isTruthyFlagValue(prop.value);
}

export function isWhiteboardBlock(block: BlockPropsLike): boolean {
  return isInlineWhiteboardBlock(block) || isPageWhiteboardBlock(block);
}

export function panelIsBlockViewRoot(
  panel: { view?: unknown; viewArgs?: { blockId?: unknown } } | null | undefined,
  blockId: DbId,
): boolean {
  if (panel == null) return false;
  if (panel.view !== "block") return false;
  return asBlockId(panel.viewArgs?.blockId) === blockId;
}

export function redirectKey(panelId: string, blockId: DbId): string {
  return `${panelId}:${blockId}`;
}

export function shouldAutoOpenPageBoard(opts: {
  settingOn: boolean;
  suppressed: boolean;
  isPageWhiteboard: boolean;
}): boolean {
  return opts.settingOn && !opts.suppressed && opts.isPageWhiteboard;
}

export function shouldAutoOpenInlineRoot(opts: {
  settingOn: boolean;
  suppressed: boolean;
  isInlineWhiteboard: boolean;
  isPanelRoot: boolean;
}): boolean {
  return (
    opts.settingOn &&
    !opts.suppressed &&
    opts.isInlineWhiteboard &&
    opts.isPanelRoot
  );
}

export type PanelNodeLike = {
  id?: unknown;
  view?: unknown;
  viewArgs?: { blockId?: unknown } | null;
  children?: readonly PanelNodeLike[] | null;
} | null | undefined;

function walkViewPanels(
  node: PanelNodeLike,
  visit: (panel: {
    id?: unknown;
    view?: unknown;
    viewArgs?: { blockId?: unknown } | null;
  }) => void,
): void {
  if (node == null) return;
  if ("view" in node && node.view != null) {
    visit(node);
    return;
  }
  const children = node.children;
  if (children == null) return;
  for (const child of children) walkViewPanels(child, visit);
}

/** Panel roots that are currently showing a block outline (not canvas). */
export function collectBlockViewRoots(
  root: PanelNodeLike,
): Array<{ panelId: string; blockId: DbId }> {
  const out: Array<{ panelId: string; blockId: DbId }> = [];
  walkViewPanels(root, (panel) => {
    if (panel.view !== "block") return;
    const panelId = typeof panel.id === "string" ? panel.id : null;
    const blockId = asBlockId(panel.viewArgs?.blockId);
    if (panelId == null || blockId == null) return;
    out.push({ panelId, blockId });
  });
  return out;
}

/**
 * Any view panel still parked on this block (outline or canvas).
 * Used to drop "open as outline" suppressions only after the user leaves.
 */
export function collectLiveRedirectKeys(root: PanelNodeLike): Set<string> {
  const keys = new Set<string>();
  walkViewPanels(root, (panel) => {
    const panelId = typeof panel.id === "string" ? panel.id : null;
    const blockId = asBlockId(panel.viewArgs?.blockId);
    if (panelId == null || blockId == null) return;
    keys.add(redirectKey(panelId, blockId));
  });
  return keys;
}

export function pruneRedirectKeys(
  stored: Set<string>,
  live: ReadonlySet<string>,
): void {
  for (const key of [...stored]) {
    if (!live.has(key)) stored.delete(key);
  }
}

export type TurnIntoCardsPlan =
  | { action: "keep" }
  | { action: "write"; cards: WhiteboardCard[] };

/** Keep a previous canvas if cards already exist; otherwise grid the first-level children. */
export function planTurnIntoCards(
  existing: readonly WhiteboardCard[],
  childIds: readonly DbId[],
  boardBlockId?: DbId,
): TurnIntoCardsPlan {
  if (existing.length > 0) return { action: "keep" };
  return { action: "write", cards: planChildCards(childIds, boardBlockId) };
}

export const PAGE_BOARD_ID_CACHE_TTL_MS = 60_000;
export const GET_BLOCKS_BATCH_SIZE = 200;

export type PageBoardIdCache = {
  ids: readonly DbId[];
  fetchedAt: number;
} | null;

export function isPageBoardIdCacheFresh(
  cache: PageBoardIdCache,
  now: number,
  ttlMs: number = PAGE_BOARD_ID_CACHE_TTL_MS,
): cache is { ids: readonly DbId[]; fetchedAt: number } {
  if (cache == null) return false;
  if (!Number.isFinite(now) || !Number.isFinite(cache.fetchedAt)) return false;
  return now - cache.fetchedAt < ttlMs;
}

export function rememberPageBoardId(
  ids: readonly DbId[],
  blockId: DbId,
): DbId[] {
  if (ids.includes(blockId)) return [...ids];
  return [...ids, blockId];
}

export function forgetPageBoardId(ids: readonly DbId[], blockId: DbId): DbId[] {
  return ids.filter((id) => id !== blockId);
}

/** Only mutate a still-fresh cache. Do not seed `{[id]}` — that would hide other boards. */
export function applyPageBoardCacheRemember(
  cache: PageBoardIdCache,
  blockId: DbId,
  now: number,
): PageBoardIdCache {
  if (!isPageBoardIdCacheFresh(cache, now)) return cache;
  return {
    ids: rememberPageBoardId(cache.ids, blockId),
    fetchedAt: cache.fetchedAt,
  };
}

export function applyPageBoardCacheForget(
  cache: PageBoardIdCache,
  blockId: DbId,
): PageBoardIdCache {
  if (cache == null) return null;
  return {
    ids: forgetPageBoardId(cache.ids, blockId),
    fetchedAt: cache.fetchedAt,
  };
}

export function idsMissingFromBlocks(
  ids: readonly DbId[],
  blocks: { readonly [id: number]: unknown },
): DbId[] {
  const missing: DbId[] = [];
  for (const id of ids) {
    if (blocks[id] == null) missing.push(id);
  }
  return missing;
}

export function chunkIds(ids: readonly DbId[], batchSize: number): DbId[][] {
  const size = batchSize > 0 ? batchSize : ids.length || 1;
  const out: DbId[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size));
  }
  return out;
}

export function planChildCards(
  childIds: readonly DbId[],
  boardBlockId?: DbId,
): WhiteboardCard[] {
  const seen = new Set<DbId>();
  const cards: WhiteboardCard[] = [];
  for (const id of childIds) {
    if (boardBlockId != null && id === boardBlockId) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const pos = layoutGrid(cards.length, PAGE_BOARD_COLUMNS, {
      x: GRID_ORIGIN,
      y: GRID_ORIGIN,
    });
    cards.push({
      blockId: id,
      kind: "block",
      x: pos.x,
      y: pos.y,
      w: CARD_WIDTH,
      h: CARD_HEIGHT,
    });
  }
  return cards;
}
