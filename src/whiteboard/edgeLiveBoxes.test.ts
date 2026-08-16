import { reconcileLiveBoxes } from "./edgeLiveBoxes.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const cardA = { blockId: 1, x: 0, y: 0, w: 100, h: 80 };
const cardB = { blockId: 2, x: 200, y: 0, w: 100, h: 80 };
const boardCard = { blockId: 900, x: 400, y: 0, w: 160, h: 100 };

const live = new Map<number, { x: number; y: number; w: number; h: number }>();

// Drag B onto the board card: persist is still the original box.
live.set(2, { x: 410, y: 10, w: 100, h: 80 });
reconcileLiveBoxes(live, [cardA, cardB, boardCard]);
check(
  live.get(2)?.x === 410,
  "in-progress drag keeps a live box that differs from persist",
);

// Drop: B leaves board A. The drop-location box must not linger —
// undo will put B back at its persist position, and a leftover live box
// would keep painting the remapped line onto the board card.
reconcileLiveBoxes(live, [cardA, boardCard]);
check(!live.has(2), "removing a card drops its live box");

// Undo: B returns at the original persist position. No stale drop box.
reconcileLiveBoxes(live, [cardA, cardB, boardCard]);
check(!live.has(2), "restored card uses persist, not a previous drop location");

// Persist caught up after a committed move: drop the matching live box.
live.set(1, { x: 0, y: 0, w: 100, h: 80 });
reconcileLiveBoxes(live, [cardA, cardB, boardCard]);
check(!live.has(1), "live box that matches persist is released");

console.log("edgeLiveBoxes.test.ts ok");
