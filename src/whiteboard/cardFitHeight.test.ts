import { MIN_CARD_HEIGHT } from "./layout.ts";
import {
  applyFitPatches,
  overlapsX,
  planContentHeightPatches,
  shouldLockCardHeight,
  type FitCard,
} from "./cardFitHeight.ts";

function check(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const gap = 16;

function card(
  id: number,
  x: number,
  y: number,
  w = 200,
  h = 120,
): FitCard {
  return { blockId: id, x, y, w, h };
}

const none = planContentHeightPatches([card(1, 0, 0, 200, 200)], 1, 200, gap);
check(none.length === 0, "same height is a no-op");

const missing = planContentHeightPatches([card(1, 0, 0)], 99, 300, gap);
check(missing.length === 0, "unknown card is a no-op");

const growOnly = planContentHeightPatches([card(1, 0, 0, 200, 120)], 1, 300, gap);
check(
  growOnly.length === 1 &&
    growOnly[0].blockId === 1 &&
    growOnly[0].patch.h === 300 &&
    growOnly[0].patch.y == null,
  "lonely card only changes height",
);

const shrinkOnly = planContentHeightPatches(
  [card(1, 0, 0, 200, 400), card(2, 0, 420, 200, 120)],
  1,
  200,
  gap,
);
check(
  shrinkOnly.length === 1 &&
    shrinkOnly[0].blockId === 1 &&
    shrinkOnly[0].patch.h === 200 &&
    shrinkOnly[0].patch.y == null,
  "shrink does not pull the card below back up",
);

const below = planContentHeightPatches(
  [card(1, 0, 0, 200, 120), card(2, 0, 140, 200, 120)],
  1,
  300,
  gap,
);
check(
  below.some((item) => item.blockId === 1 && item.patch.h === 300),
  "source grows",
);
const pushed = below.find((item) => item.blockId === 2);
check(
  pushed != null && pushed.patch.y === 300 + gap,
  "overlapping card below is pushed to source bottom + gap",
);

const beside = planContentHeightPatches(
  [card(1, 0, 0, 200, 120), card(2, 200, 140, 200, 120)],
  1,
  300,
  gap,
);
check(
  beside.every((item) => item.blockId !== 2),
  "card that only touches on X is not pushed",
);

const far = planContentHeightPatches(
  [card(1, 0, 0, 200, 120), card(2, 0, 800, 200, 120)],
  1,
  300,
  gap,
);
check(
  far.every((item) => item.blockId !== 2),
  "card far below with a gap is left alone",
);

const above = planContentHeightPatches(
  [card(1, 0, 200, 200, 120), card(2, 0, 0, 200, 120)],
  1,
  300,
  gap,
);
check(
  above.every((item) => item.blockId !== 2),
  "card above the source is not pushed",
);

const cascade = planContentHeightPatches(
  [
    card(1, 0, 0, 200, 120),
    card(2, 0, 140, 200, 120),
    card(3, 0, 280, 200, 120),
  ],
  1,
  300,
  gap,
);
const mid = cascade.find((item) => item.blockId === 2);
const tail = cascade.find((item) => item.blockId === 3);
check(mid != null && mid.patch.y === 300 + gap, "first card below moves");
check(
  tail != null && tail.patch.y === 300 + gap + 120 + gap,
  "the shove cascades to the next overlapping card",
);

const sideChain = planContentHeightPatches(
  [
    card(1, 0, 0, 200, 120),
    card(2, 250, 140, 200, 120),
    card(3, 0, 280, 200, 120),
  ],
  1,
  300,
  gap,
);
check(
  sideChain.every((item) => item.blockId !== 2),
  "a card to the side is not in the stack",
);
check(
  sideChain.some((item) => item.blockId === 3 && item.patch.y === 300 + gap),
  "the card that does overlap X still moves",
);

const floor = planContentHeightPatches([card(1, 0, 0, 200, 200)], 1, 40, gap);
check(
  floor.length === 1 && floor[0].patch.h === MIN_CARD_HEIGHT,
  "height is clamped to the minimum",
);

check(overlapsX(card(1, 0, 0, 100), card(2, 99, 0, 100)) === true, "x overlap");
check(
  overlapsX(card(1, 0, 0, 100), card(2, 100, 0, 100)) === false,
  "x touching is not overlap",
);

const applied = applyFitPatches(
  [card(1, 0, 0, 200, 120), card(2, 0, 140, 200, 120)],
  [
    { blockId: 1, patch: { h: 300 } },
    { blockId: 2, patch: { y: 316 } },
  ],
);
check(applied[0].h === 300 && applied[1].y === 316, "patches apply in place");

const vertical = ["n", "s", "ne", "nw", "se", "sw"];
for (const handle of vertical) {
  check(
    shouldLockCardHeight(handle, 200, 300) === true,
    `${handle} locks when height changes`,
  );
  check(
    shouldLockCardHeight(handle, 200, 200) === false,
    `${handle} does not lock when height is unchanged`,
  );
}
check(
  shouldLockCardHeight("e", 200, 300) === false,
  "east handle does not lock even if height changed",
);
check(
  shouldLockCardHeight("w", 200, 180) === false,
  "west handle does not lock even if height changed",
);

console.log("cardFitHeight.test.ts ok");
