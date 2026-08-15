import {
  canUndo,
  holdHistory,
  historyDepth,
  recordBefore,
  resetAllHistory,
} from "./boardHistory.ts";
import type { WhiteboardCard } from "./cards.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function card(blockId: number): WhiteboardCard {
  return { blockId, kind: "block", x: 1, y: 1, w: 10, h: 10 };
}

resetAllHistory();

const boardA = 11;
const boardB = 22;
const empty = { cards: [] as WhiteboardCard[], edges: [] };
const moved = { cards: [card(1)], edges: [] };

recordBefore(boardA, empty);
recordBefore(boardB, empty);
check(historyDepth(boardA) === 1, "board A recorded its first snapshot");
check(historyDepth(boardB) === 1, "board B recorded its first snapshot");

const releaseA = holdHistory(boardA);
recordBefore(boardB, moved);
check(
  historyDepth(boardB) === 2,
  "board B still records while board A is held",
);
recordBefore(boardA, moved);
check(
  historyDepth(boardA) === 1,
  "board A's own hold keeps its drag out of the undo stack",
);
releaseA();

recordBefore(boardA, moved);
check(historyDepth(boardA) === 2, "board A records again after its hold is released");
check(canUndo(boardA) && canUndo(boardB), "both boards can undo independently");

resetAllHistory();
console.log("boardHistoryHold.test.ts ok");
