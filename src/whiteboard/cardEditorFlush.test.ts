import {
  CARD_EDITOR_FLUSH_MS,
  cardEditorFlushDelayMs,
  markCardEditorInput,
  resetCardEditorFlushForTest,
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

console.log("cardEditorFlush.test.ts ok");
