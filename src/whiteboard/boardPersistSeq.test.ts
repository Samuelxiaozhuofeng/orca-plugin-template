import { shouldApplyPersistSeq } from "./boardPersistQueue.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

check(
  shouldApplyPersistSeq(3, 5) === true,
  "a newer write seq is applied",
);
check(
  shouldApplyPersistSeq(5, 2) === false,
  "an older write seq is discarded",
);
check(
  shouldApplyPersistSeq(4, 4) === false,
  "an equal write seq is discarded as a duplicate",
);
check(
  shouldApplyPersistSeq(0, 1) === true,
  "the first write after init is applied",
);

console.log("boardPersistSeq.test.ts ok");
