import type { DbId } from "../orca.d.ts";
import {
  CARD_TREE_LOAD_MAX_DEPTH,
  CARD_TREE_LOAD_MAX_NODES,
} from "./cardTreeQueue";
import { idsReplacedIn, registerBlockPresence } from "./blockPresence";
import {
  boardCardInfoEqual,
  readBoardCardInfo,
  type BoardCardInfo,
} from "./boardCardView";
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
  /** Null when the hosted block is not a whiteboard. */
  board: BoardCardInfo | null;
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

export function cardBlockWatchIds(
  blockId: DbId,
  blocks: {
    [id: number]: { text?: string; children?: DbId[] } | undefined;
  } = liveBlocks(),
): DbId[] {
  return collectBlockTreeIds(
    [blockId],
    blocks,
    CARD_TREE_LOAD_MAX_NODES,
    CARD_TREE_LOAD_MAX_DEPTH,
  );
}

/**
 * Re-render only when `compute()` changes. Watches the listed blocks
 * in-place, plus identity replace/delete of those keys via the shared
 * blocks-map detector. Unrelated notes do not call `setState`.
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
    const presence = registerBlockPresence(() => refresh());

    const detachBlocks = () => {
      for (const unsub of unsubs) unsub();
      unsubs = [];
    };

    const attach = (ids: DbId[]) => {
      detachBlocks();
      idList = ids;
      lastById.clear();
      for (const id of ids) {
        const block = orca.state.blocks[id];
        lastById.set(id, block);
        const unsub = trySubscribe(block, refresh);
        if (unsub) unsubs.push(unsub);
      }
      presence.setIds(ids);
    };

    const refresh = () => {
      const ids = [...watchIdsRef.current()];
      if (
        !sameList(ids, idList) ||
        idsReplacedIn(ids, lastById, orca.state.blocks)
      ) {
        attach(ids);
      }
      const next = computeRef.current();
      if (isEqualRef.current(valueRef.current, next)) return;
      valueRef.current = next;
      setValue(next);
    };

    attach([...watchIdsRef.current()]);
    refresh();
    return () => {
      detachBlocks();
      presence.dispose();
    };
  }, deps);

  return current;
}

export function readCardBlockView(blockId: DbId): CardBlockView {
  const block = orca.state.blocks[blockId];
  return {
    exists: block != null,
    text: block?.text,
    childCount: block?.children?.length ?? 0,
    excerpt: cardExcerpt(
      cachedBlockPlainText(
        blockId,
        liveBlocks(),
        CARD_TREE_LOAD_MAX_NODES,
        CARD_TREE_LOAD_MAX_DEPTH,
      ),
    ),
    board: readBoardCardInfo(block),
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
    a.excerpt === b.excerpt &&
    boardCardInfoEqual(a.board, b.board)
  );
}

export function useCardBlockView(blockId: DbId, epoch = 0): CardBlockView {
  return useWatchedValue(
    () => readCardBlockView(blockId),
    () => cardBlockWatchIds(blockId),
    [blockId, epoch],
    cardBlockViewEqual,
  );
}
