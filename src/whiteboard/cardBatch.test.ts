import {
  colorIdForDigit,
  planColorPatches,
  planUnifySizePatches,
} from "./cardBatch.ts";
import type { WhiteboardCard } from "./cards.ts";

function check(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function card(
  id: number,
  extra: Partial<WhiteboardCard> = {},
): WhiteboardCard {
  return {
    blockId: id,
    kind: "block",
    x: 0,
    y: 0,
    w: 200,
    h: 160,
    ...extra,
  };
}

check(colorIdForDigit("0") === undefined, "0 clears colour");
check(colorIdForDigit("1") === "blue", "1 is blue");
check(colorIdForDigit("5") === "purple", "5 is purple");
check(colorIdForDigit("6") === null, "6 is not a colour key");

const board = [
  card(1, { color: "blue", w: 200, h: 160 }),
  card(2, { w: 340, h: 220 }),
  card(3, { color: "green", w: 180, h: 140 }),
  card(4, { w: 200, h: 160 }),
];

const colorAll = planColorPatches(board, new Set([1, 2, 3]), "yellow");
check(colorAll.length === 3, "three cards get a colour patch");
check(
  colorAll.every((item) => item.patch.color === "yellow"),
  "every patch is yellow",
);
check(
  new Set(colorAll.map((item) => item.blockId)).size === 3,
  "one patch per card — a single batch",
);

const skipSame = planColorPatches(board, new Set([1, 2]), "blue");
check(skipSame.length === 1, "already-blue card is skipped");
check(skipSame[0].blockId === 2, "only the uncoloured card is patched");

const clear = planColorPatches(board, new Set([1, 3]), undefined);
check(clear.length === 2, "clear writes a patch for coloured cards");
check(
  clear.every((item) => item.patch.color === undefined),
  "clear uses undefined colour",
);

const ignoreHidden = planColorPatches(board, new Set([1]), "coral");
check(ignoreHidden.length === 1 && ignoreHidden[0].blockId === 1, "only selected");

const oneCard = planUnifySizePatches(board, new Set([1]), "widest");
check(oneCard.length === 0, "unify needs two or more cards");

const widest = planUnifySizePatches(board, new Set([1, 2, 3]), "widest");
check(widest.length === 2, "two cards change when matching the widest");
check(
  widest.every((item) => item.patch.w === 340 && item.patch.h === 220),
  "widest uses max width and max height",
);
check(
  widest.every((item) => item.patch.hLock === true),
  "height change locks auto-height",
);
check(
  !widest.some((item) => item.blockId === 2),
  "already-max card is not patched",
);
check(
  new Set(widest.map((item) => item.blockId)).size === widest.length,
  "unify size is one batch",
);

const narrowest = planUnifySizePatches(board, new Set([1, 2, 3]), "narrowest");
check(
  narrowest.every((item) => item.patch.w === 180 && item.patch.h === 140),
  "narrowest uses min width and min height",
);

const collapsedLeftOut = planUnifySizePatches(
  board,
  new Set([1, 2]),
  "widest",
);
check(
  !collapsedLeftOut.some((item) => item.blockId === 3),
  "cards not in the selected set (e.g. collapsed) are not patched",
);

console.log("cardBatch tests passed");
