import {
  CARD_EDITOR_FLUSH_MS,
  cardEditorFlushDelayMs,
  flushCardEditorsAndWait,
  markCardEditorInput,
  parkedCardEditorCount,
  resetCardEditorFlush,
  resetCardEditorFlushForTest,
  scheduleCardEditorRelease,
} from "./cardEditorFlush.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

resetCardEditorFlushForTest();
check(cardEditorFlushDelayMs(1_000) === 0, "no input → no wait");

markCardEditorInput(1_000);
check(
  cardEditorFlushDelayMs(1_000) === CARD_EDITOR_FLUSH_MS,
  "just typed → full flush window",
);
check(
  cardEditorFlushDelayMs(1_000 + 100) === CARD_EDITOR_FLUSH_MS - 100,
  "partial window remaining",
);
check(
  cardEditorFlushDelayMs(1_000 + CARD_EDITOR_FLUSH_MS) === 0,
  "window elapsed → unmount immediately",
);
check(
  cardEditorFlushDelayMs(1_000 + CARD_EDITOR_FLUSH_MS + 2_000) === 0,
  "long idle after typing → no extra wait",
);

resetCardEditorFlush();
const started = Date.now();
await flushCardEditorsAndWait(started);
check(
  Date.now() - started < 50,
  "no recent typing → flush wait returns immediately",
);

let released = 0;
const instant = scheduleCardEditorRelease(() => {
  released += 1;
}, 0);
check(instant.scheduled === false, "zero wait releases immediately");
check(released === 1, "zero wait calls release once");

released = 0;
const queued: Array<{ fn: () => void; ms: number }> = [];
const delayed = scheduleCardEditorRelease(
  () => {
    released += 1;
  },
  120,
  (fn, ms) => {
    queued.push({ fn, ms });
    return 1;
  },
);
check(delayed.scheduled === true && delayed.wait === 120, "positive wait is scheduled");
check(released === 0, "scheduled release has not run yet");
check(queued.length === 1 && queued[0].ms === 120, "timer uses the remaining window");
queued[0].fn();
check(released === 1, "scheduled release runs when the timer fires");

check(parkedCardEditorCount() === 0, "tests do not leak parked editors");

console.log("cardEditorFlush.test.ts ok");
