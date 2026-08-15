import {
  CARD_HEIGHT,
  CARD_WIDTH,
  GRID_GAP,
  layoutGrid,
} from "./layout.ts";
import type { WhiteboardCard } from "./cards.ts";
import {
  planTagToBoardCards,
  TAG_TO_BOARD_COLUMNS,
  TAG_TO_BOARD_LIMIT,
} from "./tagToBoard.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function card(blockId: number, x = 0, y = 0): WhiteboardCard {
  return { blockId, kind: "block", x, y, w: CARD_WIDTH, h: CARD_HEIGHT };
}

// 1. Empty board → place all, grid coords do not overlap and step by cell size.
{
  const ids = [10, 20, 30, 40, 50];
  const plan = planTagToBoardCards({
    blockIds: ids,
    existing: [],
    limit: TAG_TO_BOARD_LIMIT,
  });
  check(plan.added === 5, "empty board places every tagged note");
  check(plan.incoming.length === 5, "incoming matches added");
  check(plan.skippedExisting === 0, "empty board skips none");
  check(plan.truncated === 0, "under the cap is not truncated");
  check(plan.sourceCount === 5, "sourceCount is the tagged list length");

  const origin = { x: 0, y: 0 };
  const keys = new Set<string>();
  for (let i = 0; i < plan.incoming.length; i++) {
    const next = plan.incoming[i];
    const expected = layoutGrid(i, TAG_TO_BOARD_COLUMNS, origin);
    check(next.blockId === ids[i], `card ${i} keeps input order`);
    check(next.x === expected.x && next.y === expected.y, `card ${i} sits on the grid`);
    check(next.w === CARD_WIDTH && next.h === CARD_HEIGHT, `card ${i} uses default size`);
    const key = `${next.x},${next.y}`;
    check(!keys.has(key), `card ${i} overlaps another card`);
    keys.add(key);
  }
  check(
    plan.incoming[1].x === plan.incoming[0].x + CARD_WIDTH + GRID_GAP,
    "next column steps by width + gap",
  );
  check(
    plan.incoming[TAG_TO_BOARD_COLUMNS].y ===
      plan.incoming[0].y + CARD_HEIGHT + GRID_GAP,
    "next row steps by height + gap",
  );
}

// 2. Some ids already on the board → only add the missing ones, skip count matches.
{
  const existing = [card(2, 0, 0), card(4, 100, 0)];
  const plan = planTagToBoardCards({
    blockIds: [1, 2, 3, 4, 5],
    existing,
    limit: TAG_TO_BOARD_LIMIT,
  });
  check(plan.added === 3, "only missing ids are added");
  check(
    plan.incoming.map((item) => item.blockId).join(",") === "1,3,5",
    "added ids are the ones not already on the board",
  );
  check(plan.skippedExisting === 2, "already-on-board count is 2");
  check(plan.truncated === 0, "no truncation when under the cap");
  check(
    plan.incoming[0].x === 0 &&
      plan.incoming[0].y === CARD_HEIGHT + GRID_GAP,
    "new grid starts below existing cards",
  );
}

// 3. Over the cap → plan only the first N new notes and report how many were cut.
{
  const ids = [1, 2, 3, 4, 5, 6, 7];
  const plan = planTagToBoardCards({
    blockIds: ids,
    existing: [],
    limit: 3,
  });
  check(plan.added === 3, "over-cap places only the limit");
  check(
    plan.incoming.map((item) => item.blockId).join(",") === "1,2,3",
    "over-cap keeps the first N ids",
  );
  check(plan.truncated === 4, "truncated count is the overflow");
  check(plan.limit === 3, "plan echoes the cap");

  const withExisting = planTagToBoardCards({
    blockIds: ids,
    existing: [card(1), card(2)],
    limit: 3,
  });
  check(
    withExisting.incoming.map((item) => item.blockId).join(",") === "3,4,5",
    "cap applies after skipping ids already on the board",
  );
  check(withExisting.skippedExisting === 2, "existing still counted when over cap");
  check(withExisting.truncated === 2, "remaining new ids past the cap are truncated");
}

// 4. Tag has no notes → empty plan, no throw.
{
  const plan = planTagToBoardCards({
    blockIds: [],
    existing: [card(99)],
    limit: TAG_TO_BOARD_LIMIT,
  });
  check(plan.added === 0, "empty tag adds nothing");
  check(plan.incoming.length === 0, "empty tag has no incoming cards");
  check(plan.skippedExisting === 0, "empty tag skips none");
  check(plan.truncated === 0, "empty tag is not truncated");
  check(plan.sourceCount === 0, "empty tag sourceCount is 0");
}

console.log("tagToBoard.test.ts ok");
