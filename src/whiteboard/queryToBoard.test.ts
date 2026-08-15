import { CARD_HEIGHT, CARD_WIDTH, GRID_GAP, layoutGrid } from "./layout.ts";
import type { WhiteboardCard } from "./cards.ts";
import {
  collectQueryResultIds,
  hasQueryGroup,
  isQueryBlock,
  planQueryToBoardCards,
  QUERY_TO_BOARD_COLUMNS,
  QUERY_TO_BOARD_LIMIT,
  queryBackendPayload,
  queryDescriptionFromBlock,
} from "./queryToBoard.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function card(blockId: number, x = 0, y = 0): WhiteboardCard {
  return { blockId, kind: "block", x, y, w: CARD_WIDTH, h: CARD_HEIGHT };
}

function queryBlock(q: unknown) {
  return {
    id: 9,
    properties: [{ name: "_repr", value: { type: "query", q } }],
  };
}

// 1. Identify query blocks and read `_repr.q` as either a description or a group.
{
  check(isQueryBlock(queryBlock({ kind: 100, conditions: [] })) === true, "query type is detected");
  check(
    isQueryBlock({
      properties: [{ name: "_repr", value: { type: "query2", q: { kind: 1 } } }],
    }) === true,
    "query2 type is also a query block",
  );
  check(
    isQueryBlock({ properties: [{ name: "_repr", value: { type: "text" } }] }) ===
      false,
    "text block is not a query",
  );
  check(isQueryBlock({}) === false, "missing _repr is not a query");

  const nested = queryDescriptionFromBlock(
    queryBlock({
      q: { kind: 100, conditions: [{ kind: 4, name: "a" }] },
      sort: [["_modified", "DESC"]],
    }),
  );
  check(nested != null, "nested QueryDescription is read");
  check(
    (nested?.q as { kind?: number })?.kind === 100,
    "nested description keeps the group",
  );
  check(hasQueryGroup(nested) === true, "nested description has a group");

  const group = queryDescriptionFromBlock(
    queryBlock({ kind: 4, name: "inbox" }),
  );
  check(
    (group?.q as { kind?: number; name?: string })?.name === "inbox",
    "bare query group is wrapped as { q }",
  );
  check(hasQueryGroup(group) === true, "wrapped group counts as a query");

  check(
    queryDescriptionFromBlock(queryBlock(null)) == null,
    "query block with no q is not a description",
  );
  check(hasQueryGroup(null) === false, "missing description has no group");
}

// 2. Backend payload keeps conditions/sort and drops view-only fields.
{
  const payload = queryBackendPayload(
    {
      q: { kind: 100, conditions: [] },
      sort: [["_created", "ASC"]],
      tagName: "work",
      excludeId: 12,
    },
    9,
  );
  check(payload.q != null, "payload sends the group");
  check(payload.pageSize === -1, "payload asks for every hit");
  check(payload.excludeId === 12, "payload keeps an explicit excludeId");
  check(payload.tagName === "work", "payload keeps tagName");
  check(payload.sort != null, "payload keeps sort");
  check(!("asTable" in payload), "payload does not send table view");
  check(!("asCalendar" in payload), "payload does not send calendar view");

  const fallback = queryBackendPayload({ q: { kind: 1 } }, 77);
  check(fallback.excludeId === 77, "payload excludes the query block by default");
}

// 3. Collect ids from numbers, block objects, and table rows.
{
  check(
    collectQueryResultIds([10, 20, { id: 30 }, { _block: 40 }]).join(",") ===
      "10,20,30,40",
    "ids are taken from numbers, id, and _block",
  );
  check(collectQueryResultIds(null).length === 0, "null result is empty");
  check(collectQueryResultIds([]).length === 0, "empty array is empty");
  let threw = false;
  try {
    collectQueryResultIds({ items: [1] });
  } catch {
    threw = true;
  }
  check(threw, "non-array result is rejected");
  threw = false;
  try {
    collectQueryResultIds([{ text: "no id" }]);
  } catch {
    threw = true;
  }
  check(threw, "array with no ids is rejected");
}

// 4. Empty query → empty plan, no throw.
{
  const plan = planQueryToBoardCards({
    blockIds: [],
    existing: [card(99)],
    limit: QUERY_TO_BOARD_LIMIT,
  });
  check(plan.added === 0, "empty query adds nothing");
  check(plan.incoming.length === 0, "empty query has no incoming cards");
  check(plan.sourceCount === 0, "empty query sourceCount is 0");
  check(plan.truncated === 0, "empty query is not truncated");
}

// 5. Skip ids already on the board (and the board itself); do not duplicate.
{
  const existing = [card(2, 0, 0), card(4, 100, 0)];
  const plan = planQueryToBoardCards({
    blockIds: [1, 2, 3, 4, 5, 5, 8],
    existing,
    limit: QUERY_TO_BOARD_LIMIT,
    boardBlockId: 8,
  });
  check(plan.added === 3, "only missing ids are added");
  check(
    plan.incoming.map((item) => item.blockId).join(",") === "1,3,5",
    "added ids are the ones not already on the board",
  );
  check(plan.skippedExisting === 3, "already-on-board and duplicate count together");
  check(plan.skippedSelf === 1, "the target board is not nested as a card");
  check(
    plan.incoming[0].x === 0 && plan.incoming[0].y === CARD_HEIGHT + GRID_GAP,
    "new grid starts below existing cards",
  );
}

// 6. Over the cap → only the first N new notes, and truncated is reported.
{
  const ids = [1, 2, 3, 4, 5, 6, 7];
  const plan = planQueryToBoardCards({
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

  const withExisting = planQueryToBoardCards({
    blockIds: ids,
    existing: [card(1), card(2)],
    limit: 3,
  });
  check(
    withExisting.incoming.map((item) => item.blockId).join(",") === "3,4,5",
    "cap applies after skipping ids already on the board",
  );
  check(withExisting.truncated === 2, "remaining new ids past the cap are truncated");
}

// 7. Incoming cards sit on a non-overlapping grid.
{
  const ids = [10, 20, 30, 40, 50];
  const plan = planQueryToBoardCards({
    blockIds: ids,
    existing: [],
    limit: QUERY_TO_BOARD_LIMIT,
  });
  const origin = { x: 0, y: 0 };
  const keys = new Set<string>();
  for (let i = 0; i < plan.incoming.length; i++) {
    const next = plan.incoming[i];
    const expected = layoutGrid(i, QUERY_TO_BOARD_COLUMNS, origin);
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
    plan.incoming[QUERY_TO_BOARD_COLUMNS].y ===
      plan.incoming[0].y + CARD_HEIGHT + GRID_GAP,
    "next row steps by height + gap",
  );
}

console.log("queryToBoard.test.ts ok");
