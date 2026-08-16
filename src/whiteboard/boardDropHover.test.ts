import { resolveBoardDropTarget } from "./boardDropTarget.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const cards = [
  { blockId: 1, x: 0, y: 0, w: 100, h: 80 },
  { blockId: 900, x: 200, y: 0, w: 100, h: 80 },
  { blockId: 2, x: 400, y: 0, w: 100, h: 80 },
];

const base = {
  world: { x: 250, y: 40 },
  cards,
  movingIds: new Set([1]),
  currentBoardId: 10,
  isBoardCard: (id: number) => id === 900,
  allowDrop: true,
  altHeld: false,
};

check(
  resolveBoardDropTarget(base) === 900,
  "pointer over a board card arms that board",
);

check(
  resolveBoardDropTarget({ ...base, altHeld: true }) == null,
  "Alt/Option suppresses drop",
);

check(
  resolveBoardDropTarget({ ...base, allowDrop: false }) == null,
  "source board not writable → no target",
);

check(
  resolveBoardDropTarget({
    ...base,
    isBoardCard: () => false,
  }) == null,
  "non-writable / non-board card is ignored",
);

check(
  resolveBoardDropTarget({
    ...base,
    movingIds: new Set([900]),
    world: { x: 250, y: 40 },
  }) == null,
  "cannot drop a board onto itself",
);

check(
  resolveBoardDropTarget({
    ...base,
    currentBoardId: 900,
  }) == null,
  "cannot drop onto the board we are on",
);

check(
  resolveBoardDropTarget({
    ...base,
    world: { x: 10, y: 10 },
  }) == null,
  "pointer over a regular card is not a drop",
);

console.log("boardDropHover tests passed");
