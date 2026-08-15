import { findParentCardOnBoard } from "./cardParentOnBoard.ts";

function check(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const blocks: Record<number, { id: number; parent?: number }> = {
  1: { id: 1 },
  2: { id: 2, parent: 1 },
  3: { id: 3, parent: 2 },
  9: { id: 9 },
};
const get = (id: number) => blocks[id] as never;

check(
  findParentCardOnBoard(3, new Set([1]), get) === 1,
  "walks past non-card ancestors",
);
check(
  findParentCardOnBoard(3, new Set([1, 2]), get) === 2,
  "stops at the nearest card ancestor",
);
check(findParentCardOnBoard(2, new Set([2]), get) === null, "self is not parent");
check(findParentCardOnBoard(9, new Set([1]), get) === null, "no parent chain");
check(findParentCardOnBoard(3, new Set(), get) === null, "empty board");
check(findParentCardOnBoard(3, null, get) === null, "missing board data");

const cyclic: Record<number, { id: number; parent?: number }> = {
  10: { id: 10, parent: 11 },
  11: { id: 11, parent: 10 },
};
check(
  findParentCardOnBoard(10, new Set([99]), (id) => cyclic[id] as never) === null,
  "cyclic chain terminates",
);

console.log("cardParentOnBoard tests passed");
