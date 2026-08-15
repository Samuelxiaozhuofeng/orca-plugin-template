import type { DbId } from "../orca.d.ts";

/**
 * Valtio 1.13.2 (`node_modules/valtio/vanilla.d.ts`):
 *   subscribe(proxy, (ops: Op[]) => void, notifyInSync?)
 *   Op = ['set', path, value, prev] | ['delete', path, prev]
 *        | ['resolve', path, value] | ['reject', path, error]
 *   path is (string | symbol)[].
 *
 * Subscribed to `orca.state.blocks`:
 *   top-level add/replace → ['set', ['123'], next, prev]
 *   top-level delete      → ['delete', ['123'], prev]
 *   field edit on a block → ['set', ['123', 'text'], …]  (path.length > 1)
 *
 * Object keys are strings, so path[0] is "123" even for numeric DbId.
 * plugin-docs / orca.d.ts only type `window.Valtio` as `any`; this shape
 * comes from the peer valtio Orca mounts.
 */
type ValtioOp = readonly [string, readonly unknown[], ...unknown[]];

type ValtioSubscribe = (
  proxyObject: object,
  callback: (ops: ValtioOp[]) => void,
  notifyInSync?: boolean,
) => () => void;

export type BlockPresenceMap = {
  [id: number]: object | undefined;
};

type PresenceEntry = {
  ids: DbId[];
  onReplace: () => void;
};

const entries = new Set<PresenceEntry>();
const byId = new Map<DbId, Set<PresenceEntry>>();
let unsubMap: (() => void) | null = null;
let inspectCount = 0;

function trySubscribe(
  target: object | undefined,
  onChange: (ops: ValtioOp[]) => void,
): (() => void) | null {
  if (target == null) return null;
  const subscribe = (
    window as { Valtio?: { subscribe?: ValtioSubscribe } }
  ).Valtio?.subscribe;
  if (subscribe == null) return null;
  try {
    return subscribe(target, onChange, true);
  } catch {
    return null;
  }
}

export function idsReplacedIn(
  ids: readonly DbId[],
  lastById: Map<DbId, object | undefined>,
  blocks: BlockPresenceMap,
): boolean {
  if (ids.length !== lastById.size) return true;
  for (const id of ids) {
    if (blocks[id] !== lastById.get(id)) return true;
  }
  return false;
}

function asBlockId(key: unknown): DbId | null {
  if (typeof key === "number" && Number.isFinite(key)) return key;
  if (typeof key !== "string" || key === "") return null;
  const id = Number(key);
  return Number.isFinite(id) ? id : null;
}

/** `null` = ops missing/malformed. Otherwise top-level set/delete ids. */
export function topLevelBlockIdsFromOps(ops: unknown): DbId[] | null {
  if (!Array.isArray(ops)) return null;
  const ids: DbId[] = [];
  const seen = new Set<DbId>();
  for (const item of ops) {
    if (!Array.isArray(item) || item.length < 2) return null;
    const type = item[0];
    const path = item[1];
    if (!Array.isArray(path) || path.length !== 1) continue;
    if (type !== "set" && type !== "delete") continue;
    const id = asBlockId(path[0]);
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function indexId(id: DbId, entry: PresenceEntry): void {
  let set = byId.get(id);
  if (set == null) {
    set = new Set();
    byId.set(id, set);
  }
  set.add(entry);
}

function unindexEntry(entry: PresenceEntry): void {
  for (const id of entry.ids) {
    const set = byId.get(id);
    if (set == null) continue;
    set.delete(entry);
    if (set.size === 0) byId.delete(id);
  }
}

function notifyForIds(ids: readonly DbId[]): void {
  const notify = new Set<PresenceEntry>();
  for (const id of ids) {
    inspectCount += 1;
    const set = byId.get(id);
    if (set == null) continue;
    for (const entry of set) notify.add(entry);
  }
  for (const entry of notify) entry.onReplace();
}

function onBlocksMapChange(ops: ValtioOp[]): void {
  const changed = topLevelBlockIdsFromOps(ops);
  if (changed == null) {
    // Valtio 1.13 always passes ops. Missing/malformed → treat as nested.
    // Do not Object.keys(blocks): that is O(vault), not O(1).
    return;
  }
  if (changed.length === 0) return;
  notifyForIds(changed);
}

function syncMapSubscribe(): void {
  const need = byId.size > 0;
  if (need) {
    if (unsubMap != null) return;
    unsubMap = trySubscribe(orca.state.blocks, onBlocksMapChange);
    return;
  }
  if (unsubMap == null) return;
  unsubMap();
  unsubMap = null;
}

export type BlockPresenceHandle = {
  setIds: (ids: readonly DbId[]) => void;
  dispose: () => void;
};

/**
 * One Valtio subscribe on `orca.state.blocks` shared by every card.
 * Nested field writes are ignored here; callers subscribe to the
 * individual blocks they watch.
 */
export function registerBlockPresence(onReplace: () => void): BlockPresenceHandle {
  const entry: PresenceEntry = {
    ids: [],
    onReplace,
  };
  entries.add(entry);
  return {
    setIds(ids) {
      unindexEntry(entry);
      entry.ids = [...ids];
      for (const id of ids) indexId(id, entry);
      syncMapSubscribe();
    },
    dispose() {
      unindexEntry(entry);
      entries.delete(entry);
      syncMapSubscribe();
    },
  };
}

export function blockPresenceMapSubscribed(): boolean {
  return unsubMap != null;
}

export function blockPresenceWatcherCount(): number {
  return entries.size;
}

export function blockPresenceInspectCount(): number {
  return inspectCount;
}

export function resetBlockPresenceInspectCount(): void {
  inspectCount = 0;
}

export function resetBlockPresenceForTests(): void {
  entries.clear();
  byId.clear();
  inspectCount = 0;
  if (unsubMap != null) {
    unsubMap();
    unsubMap = null;
  }
}
