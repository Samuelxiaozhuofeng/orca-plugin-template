import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { writeCards, type WhiteboardCard } from "./data";

const { useCallback, useEffect, useRef, useState } = window.React;

const WRITE_DEBOUNCE_MS = 300;

export type CardBoxPatch = Partial<
  Pick<WhiteboardCard, "x" | "y" | "w" | "h">
>;

type PersistBox = {
  blockId: DbId | null;
  local: WhiteboardCard[];
  baseline: WhiteboardCard[];
  pending: WhiteboardCard[] | null;
  dirty: boolean;
  awaitingEcho: boolean;
  timer: number;
  inFlight: boolean;
};

function sameCards(left: WhiteboardCard[], right: WhiteboardCard[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function notifyWriteError(error: unknown): void {
  console.error("[whiteboard] failed to save cards", error);
  orca.notify(
    "error",
    error instanceof Error ? error.message : t("Failed to save card positions"),
  );
}

const flushers = new Set<() => Promise<void>>();

export async function flushAllCardWrites(): Promise<void> {
  await Promise.all([...flushers].map((flush) => flush()));
}

export function useCardPersist(
  blockId: DbId | null,
  serverCards: WhiteboardCard[],
): {
  cards: WhiteboardCard[];
  patchCard: (cardBlockId: DbId, patch: CardBoxPatch) => void;
  patchCards: (
    entries: ReadonlyArray<{ blockId: DbId; patch: CardBoxPatch }>,
  ) => void;
  commitCards: (next: WhiteboardCard[]) => Promise<boolean>;
  flush: () => Promise<void>;
} {
  const [cards, setCards] = useState<WhiteboardCard[]>(serverCards);
  const boxRef = useRef<PersistBox>({
    blockId,
    local: serverCards,
    baseline: serverCards,
    pending: null,
    dirty: false,
    awaitingEcho: false,
    timer: 0,
    inFlight: false,
  });
  const flightTailRef = useRef(Promise.resolve());
  const serverCardsRef = useRef(serverCards);
  serverCardsRef.current = serverCards;
  boxRef.current.blockId = blockId;

  const show = useCallback((next: WhiteboardCard[]) => {
    boxRef.current.local = next;
    setCards(next);
  }, []);

  const flushNow = useCallback(async (): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      const box = boxRef.current;
      if (box.timer !== 0) {
        window.clearTimeout(box.timer);
        box.timer = 0;
      }
      if (box.pending == null || box.blockId == null) return true;

      const id = box.blockId;
      const toWrite = box.pending;
      box.pending = null;
      box.inFlight = true;
      try {
        await writeCards(id, toWrite);
        if (box.blockId !== id) return true;
        box.baseline = toWrite;
        box.dirty = box.pending != null;
        box.awaitingEcho = !box.dirty;
        return true;
      } catch (error) {
        if (box.blockId === id) {
          // A newer patch may have landed in `pending` while this write
          // was in flight. Keep it so the queued flush can still run;
          // only roll back when nothing newer is waiting.
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

  const scheduleWrite = useCallback(() => {
    const box = boxRef.current;
    box.pending = box.local;
    box.dirty = true;
    if (box.timer !== 0) window.clearTimeout(box.timer);
    if (box.inFlight) return;
    box.timer = window.setTimeout(() => {
      box.timer = 0;
      void flushNow();
    }, WRITE_DEBOUNCE_MS);
  }, [flushNow]);

  const patchCards = useCallback(
    (entries: ReadonlyArray<{ blockId: DbId; patch: CardBoxPatch }>) => {
      if (entries.length === 0) return;
      const byId = new Map<DbId, CardBoxPatch>();
      for (const entry of entries) {
        const prev = byId.get(entry.blockId);
        byId.set(entry.blockId, prev == null ? entry.patch : { ...prev, ...entry.patch });
      }
      const next = boxRef.current.local.map((card: WhiteboardCard) => {
        const patch = byId.get(card.blockId);
        return patch == null ? card : { ...card, ...patch };
      });
      show(next);
      scheduleWrite();
    },
    [scheduleWrite, show],
  );

  const patchCard = useCallback(
    (cardBlockId: DbId, patch: CardBoxPatch) => {
      patchCards([{ blockId: cardBlockId, patch }]);
    },
    [patchCards],
  );

  const commitCards = useCallback(
    async (next: WhiteboardCard[]): Promise<boolean> => {
      show(next);
      boxRef.current.pending = next;
      boxRef.current.dirty = true;
      return flushNow();
    },
    [flushNow, show],
  );

  useEffect(() => {
    const id = blockId;
    const initial = serverCardsRef.current;
    const box = boxRef.current;
    box.local = initial;
    box.baseline = initial;
    box.pending = null;
    box.dirty = false;
    box.awaitingEcho = false;
    if (box.timer !== 0) {
      window.clearTimeout(box.timer);
      box.timer = 0;
    }
    setCards(initial);

    const flusher = () => flushNow();
    flushers.add(flusher);
    return () => {
      flushers.delete(flusher);
      if (box.timer !== 0) {
        window.clearTimeout(box.timer);
        box.timer = 0;
      }
      const leftover = box.pending;
      box.pending = null;
      if (leftover == null || id == null) return;
      void flightTailRef.current.then(() =>
        writeCards(id, leftover).catch(notifyWriteError),
      );
    };
  }, [blockId, flushNow]);

  useEffect(() => {
    const box = boxRef.current;
    if (box.awaitingEcho) {
      if (sameCards(serverCards, box.local)) {
        box.awaitingEcho = false;
        box.baseline = serverCards;
      }
      return;
    }
    if (box.pending != null || box.dirty || box.inFlight) return;
    if (!sameCards(serverCards, box.local)) {
      show(serverCards);
      box.baseline = serverCards;
    }
  }, [serverCards, show]);

  return { cards, patchCard, patchCards, commitCards, flush: flushNow };
}
