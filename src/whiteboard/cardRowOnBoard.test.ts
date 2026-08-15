import { isCardRowOnBoard } from "./cardRowOnBoard.ts";

function check(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const ids = new Set<number>([10, 20, 30]);

check(
  isCardRowOnBoard(20, 10, ids) === true,
  "child that is itself a card on this board is marked",
);
check(
  isCardRowOnBoard(10, 10, ids) === false,
  "the card's own root is never marked",
);
check(
  isCardRowOnBoard(99, 10, ids) === false,
  "a row that is not a card on this board stays unmarked",
);
check(
  isCardRowOnBoard(20, 10, null) === false,
  "a missing card list stays unmarked",
);
check(
  isCardRowOnBoard(20, 10, undefined) === false,
  "an unknown card list stays unmarked",
);
check(
  isCardRowOnBoard(20, 10, new Set()) === false,
  "an empty card list stays unmarked",
);
check(
  isCardRowOnBoard(20, 10, new Set([99])) === false,
  "cards on some other board do not mark this row",
);
check(
  isCardRowOnBoard(Number.NaN, 10, ids) === false,
  "non-finite row ids stay unmarked",
);

console.log("cardRowOnBoard tests passed");
