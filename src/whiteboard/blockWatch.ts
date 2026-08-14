import type { DbId } from "../orca.d.ts";
import {
  cachedBlockPlainText,
  cardExcerpt,
  collectBlockTreeIds,
} from "./viewTransform";

const { useEffect, useRef, useState } = window.React;
const { subscribe } = window.Valtio as {
  subscribe: (
    proxyObject: object,
    callback: () => void,
    notifyInSync?: boolean,
  ) => () => void;
};

export type CardBlockView = {
  exists: boolean;
  text: string | undefined;
  childCount: number;
  excerpt: string;
};

function liveBlocks(): {
  [id: number]: { text?: string; children?: DbId[] } | undefined;
} {
  return orca.state.blocks as {
    [id: number]: { text?: string; children?: DbId[] } | undefined;
  };
}

function trySubscribe(
  target: object | undefined,
  onChange: () => void,
): (() => void) | null {
  if (target == null) return null;
  try {
    return subscribe(target, onChange, true);
  } catch {
    return null;
  }
}

function sameList(
  a: readonly unknown[],
  b: readonly unknown[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

function idsReplaced(
  ids: readonly DbId[],
  lastById: Map<DbId, object | undefined>,
): boolean {
  if (ids.length !== lastById.size) return true;
  for (const id of ids) {
    if (orca.state.blocks[id] !== lastById.get(id)) return true;
  }
  return false;
}

/**
 * Re-render only when `compute()` changes. Watches the listed blocks
 * in-place, plus identity replace/delete of those keys on the map.
 * Unrelated notes do not call `setState`.
 */
export function useWatchedValue<T>(
  compute: () => T,
  watchIds: () => readonly DbId[],
  deps: readonly unknown[],
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const [value, setValue] = useState<T>(() => compute());
  const computeRef = useRef(compute);
  const watchIdsRef = useRef(watchIds);
  const isEqualRef = useRef(isEqual);
  const depsRef = useRef(deps);
  const valueRef = useRef(value);
  computeRef.current = compute;
  watchIdsRef.current = watchIds;
  isEqualRef.current = isEqual;

  let current = value;
  if (!sameList(depsRef.current, deps)) {
    depsRef.current = deps;
    const next = compute();
    if (!isEqual(value, next)) {
      setValue(next);
      current = next;
    }
  }
  valueRef.current = current;

  useEffect(() => {
    let unsubs: (() => void)[] = [];
    let idList: DbId[] = [];
    const lastById = new Map<DbId, object | undefined>();

    const detach = () => {
      for (const unsub of unsubs) unsub();
      unsubs = [];
    };

    const attach = (ids: DbId[]) => {
      detach();
      idList = ids;
      lastById.clear();
      for (const id of ids) {
        const block = orca.state.blocks[id];
        lastById.set(id, block);
        const unsub = trySubscribe(block, refresh);
        if (unsub) unsubs.push(unsub);
      }
      if (ids.length === 0) return;
      const unsubMap = trySubscribe(orca.state.blocks, () => {
        for (const id of idList) {
          if (orca.state.blocks[id] !== lastById.get(id)) {
            refresh();
            return;
          }
        }
      });
      if (unsubMap) unsubs.push(unsubMap);
    };

    const refresh = () => {
      const ids = [...watchIdsRef.current()];
      if (!sameList(ids, idList) || idsReplaced(ids, lastById)) {
        attach(ids);
      }
      const next = computeRef.current();
      if (isEqualRef.current(valueRef.current, next)) return;
      valueRef.current = next;
      setValue(next);
    };

    attach([...watchIdsRef.current()]);
    refresh();
    return detach;
  }, deps);

  return current;
}

export function readCardBlockView(blockId: DbId): CardBlockView {
  const block = orca.state.blocks[blockId];
  return {
    exists: block != null,
    text: block?.text,
    childCount: block?.children?.length ?? 0,
    excerpt: cardExcerpt(cachedBlockPlainText(blockId, liveBlocks())),
  };
}

export function cardBlockViewEqual(
  a: CardBlockView,
  b: CardBlockView,
): boolean {
  return (
    a.exists === b.exists &&
    a.text === b.text &&
    a.childCount === b.childCount &&
    a.excerpt === b.excerpt
  );
}

export function useCardBlockView(blockId: DbId): CardBlockView {
  return useWatchedValue(
    () => readCardBlockView(blockId),
    () =>
      collectBlockTreeIds(
        [blockId],
        liveBlocks(),
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
      ),
    [blockId],
    cardBlockViewEqual,
  );
}
