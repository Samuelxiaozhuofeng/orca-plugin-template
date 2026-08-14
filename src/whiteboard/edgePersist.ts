import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  edgesEqual,
  sanitizeEdges,
  writeEdges,
  type WhiteboardEdge,
} from "./edges";

const { useCallback, useEffect, useRef, useState } = window.React;

type PersistBox = {
  blockId: DbId | null;
  local: WhiteboardEdge[];
  baseline: WhiteboardEdge[];
  pending: WhiteboardEdge[] | null;
  dirty: boolean;
  awaitingEcho: boolean;
  inFlight: boolean;
};

function notifyWriteError(error: unknown): void {
  console.error("[whiteboard] failed to save connections", error);
  orca.notify(
    "error",
    error instanceof Error
      ? error.message
      : t("Failed to save connections"),
  );
}

const flushers = new Set<() => Promise<void>>();

export async function flushAllEdgeWrites(): Promise<void> {
  await Promise.all([...flushers].map((flush) => flush()));
}

export function useEdgePersist(
  blockId: DbId | null,
  serverEdges: WhiteboardEdge[],
  cardIds: readonly DbId[],
): {
  edges: WhiteboardEdge[];
  commitEdges: (
    next: WhiteboardEdge[],
    cardIds?: ReadonlySet<DbId>,
  ) => Promise<boolean>;
} {
  const [edges, setEdges] = useState<WhiteboardEdge[]>(serverEdges);
  const boxRef = useRef<PersistBox>({
    blockId,
    local: serverEdges,
    baseline: serverEdges,
    pending: null,
    dirty: false,
    awaitingEcho: false,
    inFlight: false,
  });
  const flightTailRef = useRef(Promise.resolve());
  const serverEdgesRef = useRef(serverEdges);
  const cardIdsRef = useRef(cardIds);
  serverEdgesRef.current = serverEdges;
  cardIdsRef.current = cardIds;
  boxRef.current.blockId = blockId;

  const show = useCallback((next: WhiteboardEdge[]) => {
    boxRef.current.local = next;
    setEdges(next);
  }, []);

  const flushNow = useCallback(async (): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      const box = boxRef.current;
      if (box.pending == null || box.blockId == null) return true;

      const id = box.blockId;
      const toWrite = sanitizeEdges(
        box.pending,
        new Set(cardIdsRef.current),
      );
      box.pending = null;
      box.inFlight = true;
      try {
        await writeEdges(id, toWrite, new Set(cardIdsRef.current));
        if (box.blockId !== id) return true;
        box.baseline = toWrite;
        box.dirty = box.pending != null;
        box.awaitingEcho = !box.dirty;
        if (!edgesEqual(box.local, toWrite) && box.pending == null) {
          show(toWrite);
        }
        return true;
      } catch (error) {
        if (box.blockId === id) {
          if (box.pending == null) {
            box.dirty = false;
            box.awaitingEcho = false;
            show(box.baseline);
          } else {
            box.dirty = true;
            box.awaitingEcho = false;
          }
          notifyWriteError(error);
        }
        return false;
      } finally {
        box.inFlight = false;
      }
    };

    const queued = flightTailRef.current.then(run, run);
    flightTailRef.current = queued.then(
      () => {},
      () => {},
    );
    const ok = await queued;
    if (boxRef.current.pending != null) {
      return flushNow();
    }
    return ok;
  }, [show]);

  const commitEdges = useCallback(
    async (
      next: WhiteboardEdge[],
      cardIds?: ReadonlySet<DbId>,
    ): Promise<boolean> => {
      const ids = cardIds ?? new Set(cardIdsRef.current);
      const cleaned = sanitizeEdges(next, ids);
      show(cleaned);
      boxRef.current.pending = cleaned;
      boxRef.current.dirty = true;
      if (cardIds != null) cardIdsRef.current = [...cardIds];
      return flushNow();
    },
    [flushNow, show],
  );

  useEffect(() => {
    const id = blockId;
    const initial = serverEdgesRef.current;
    const box = boxRef.current;
    box.local = initial;
    box.baseline = initial;
    box.pending = null;
    box.dirty = false;
    box.awaitingEcho = false;
    setEdges(initial);

    const flusher = () => flushNow();
    flushers.add(flusher);
    return () => {
      flushers.delete(flusher);
      const leftover = box.pending;
      box.pending = null;
      if (leftover == null || id == null) return;
      void flightTailRef.current.then(() =>
        writeEdges(id, leftover).catch(notifyWriteError),
      );
    };
  }, [blockId, flushNow]);

  useEffect(() => {
    const box = boxRef.current;
    if (box.awaitingEcho) {
      if (edgesEqual(serverEdges, box.local)) {
        box.awaitingEcho = false;
        box.baseline = serverEdges;
      }
      return;
    }
    if (box.pending != null || box.dirty || box.inFlight) return;
    if (!edgesEqual(serverEdges, box.local)) {
      show(serverEdges);
      box.baseline = serverEdges;
    }
  }, [serverEdges, show]);

  return { edges, commitEdges };
}
