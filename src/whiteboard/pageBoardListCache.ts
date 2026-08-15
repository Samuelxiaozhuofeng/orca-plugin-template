import type { DbId } from "../orca.d.ts";
import {
  applyPageBoardCacheForget,
  applyPageBoardCacheRemember,
  isPageBoardIdCacheFresh,
  type PageBoardIdCache,
} from "./pageBoardPlan";

let cache: PageBoardIdCache = null;
let epoch = 0;

export function pageBoardCacheEpoch(): number {
  return epoch;
}

export function getFreshPageBoardIds(now: number): readonly DbId[] | null {
  return isPageBoardIdCacheFresh(cache, now) ? cache.ids : null;
}

export function storePageBoardIds(
  ids: readonly DbId[],
  now: number,
  atEpoch: number,
): void {
  if (atEpoch !== epoch) return;
  cache = { ids: [...ids], fetchedAt: now };
}

export function rememberPageBoardInCache(blockId: DbId, now = Date.now()): void {
  cache = applyPageBoardCacheRemember(cache, blockId, now);
}

export function forgetPageBoardInCache(blockId: DbId): void {
  cache = applyPageBoardCacheForget(cache, blockId);
}

export function resetPageBoardIdCache(): void {
  cache = null;
  epoch += 1;
}
