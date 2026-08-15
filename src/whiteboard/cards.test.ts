import {
  boardPropsReadable,
  formatProtectMessage,
} from "./boardWrite.ts";
import {
  parseCards,
  readCards,
  tryParseCards,
  tryReadCards,
} from "./cards.ts";
import {
  parseEdges,
  readEdges,
  tryParseEdges,
  tryReadEdges,
} from "./edges.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function card(blockId: number): Record<string, unknown> {
  return { blockId, x: 10, y: 20, w: 240, h: 160, kind: "block" };
}

function edge(from: number, to: number): Record<string, unknown> {
  return { id: `${from}-${to}-1`, from, to, arrow: "end" };
}

function board(cards?: unknown, edges?: unknown) {
  const properties: Array<{ name: string; value?: unknown }> = [];
  if (arguments.length >= 1) properties.push({ name: "cards", value: cards });
  if (arguments.length >= 2) properties.push({ name: "edges", value: edges });
  return { properties };
}

function isOk<T>(
  result: { ok: true; value: T } | { ok: false },
): result is { ok: true; value: T } {
  return result.ok;
}

function isDropped(
  result: { ok: true } | { ok: false; reason?: string; dropped?: number },
): result is { ok: false; reason: "bad-items"; dropped: number } {
  return !result.ok && result.reason === "bad-items";
}

function isNotArray(
  result: { ok: true } | { ok: false; reason?: string },
): boolean {
  return !result.ok && result.reason === "not-array";
}

// --- empty / missing is normal, never protect ---

for (const [label, value] of [
  ["undefined", undefined],
  ["null", null],
  ["empty string", ""],
  ["whitespace", "   "],
  ["[] string", "[]"],
  ["empty array", []],
] as const) {
  const cards = tryParseCards(value);
  const edges = tryParseEdges(value);
  check(isOk(cards) && cards.value.length === 0, `cards ${label} is ok empty`);
  check(isOk(edges) && edges.value.length === 0, `edges ${label} is ok empty`);
}

check(isOk(tryReadCards(undefined)), "tryReadCards missing block");
check(isOk(tryReadCards({})), "tryReadCards no properties");
check(isOk(tryReadCards(board())), "tryReadCards empty properties");
check(isOk(tryReadEdges(undefined)), "tryReadEdges missing block");
check(isOk(tryReadEdges({})), "tryReadEdges no properties");
check(boardPropsReadable(undefined), "boardPropsReadable missing block");
check(boardPropsReadable({}), "boardPropsReadable no properties");
check(boardPropsReadable(board()), "boardPropsReadable empty properties");
check(boardPropsReadable(board("", "")), "boardPropsReadable empty strings");
check(boardPropsReadable(board("[]", "[]")), "boardPropsReadable empty arrays");

// --- valid arrays parse ---

const twoCards = [card(1), card(2)];
const twoEdges = [edge(1, 2), edge(2, 3)];
const cardsOk = tryParseCards(twoCards);
const edgesOk = tryParseEdges(twoEdges);
check(isOk(cardsOk) && cardsOk.value.length === 2, "valid cards array");
check(isOk(edgesOk) && edgesOk.value.length === 2, "valid edges array");
check(
  isOk(tryParseCards(JSON.stringify(twoCards))) &&
    tryParseCards(JSON.stringify(twoCards)).ok &&
    (tryParseCards(JSON.stringify(twoCards)) as { value: unknown[] }).value
      .length === 2,
  "valid cards JSON string",
);
check(
  isOk(tryParseEdges(JSON.stringify(twoEdges))),
  "valid edges JSON string",
);
check(boardPropsReadable(board(twoCards, twoEdges)), "valid board readable");
check(
  boardPropsReadable(board(JSON.stringify(twoCards), JSON.stringify(twoEdges))),
  "valid JSON-string board readable",
);

// missing w/h still normalizes — must not protect
const noSize = { blockId: 9, x: 1, y: 2, kind: "block" };
check(isOk(tryParseCards([noSize])), "card without w/h is valid");
check(
  isOk(tryParseEdges([{ from: 1, to: 2 }])),
  "edge without id/arrow is valid",
);
check(
  isOk(tryParseEdges([{ from: 1, to: 1, arrow: "end" }])),
  "self-loop still parses; sanitize is a later step",
);

// --- non-array → protect ---

for (const [label, value] of [
  ["object", { cards: [] }],
  ["number", 42],
  ["boolean", true],
  ["bad JSON", "{"],
  ["JSON object", "{}"],
  ["JSON number", "1"],
] as const) {
  check(isNotArray(tryParseCards(value)), `cards ${label} is not-array`);
  check(isNotArray(tryParseEdges(value)), `edges ${label} is not-array`);
}

check(!boardPropsReadable(board("{", "[]")), "bad cards JSON protects board");
check(!boardPropsReadable(board("[]", "{}")), "non-array edges protect board");
check(readCards(board("{}")).length === 0, "readCards non-array is empty");
check(readEdges(board("[]", 3)).length === 0, "readEdges non-array is empty");
check(parseCards("{}").length === 0, "parseCards non-array is empty");
check(parseEdges(1).length === 0, "parseEdges non-array is empty");

// --- one bad item among good → protect, report dropped count ---

const mixedCards = [card(1), { blockId: "bad", x: 0, y: 0 }, card(3)];
const mixedCardResult = tryParseCards(mixedCards);
check(!isOk(mixedCardResult), "mixed cards protect");
check(
  isDropped(mixedCardResult) && mixedCardResult.dropped === 1,
  "mixed cards dropped count is 1",
);
check(
  parseCards(mixedCards).length === 0,
  "parseCards does not keep the good items after a drop",
);

const mixedEdges = [edge(1, 2), { from: 1 }, edge(3, 4)];
const mixedEdgeResult = tryParseEdges(mixedEdges);
check(!isOk(mixedEdgeResult), "mixed edges protect");
check(
  isDropped(mixedEdgeResult) && mixedEdgeResult.dropped === 1,
  "mixed edges dropped count is 1",
);
check(
  parseEdges(mixedEdges).length === 0,
  "parseEdges does not keep the good items after a drop",
);

const mixedBlock = board(mixedCards, mixedEdges);
check(!tryReadCards(mixedBlock).ok, "tryReadCards mixed protects");
check(!tryReadEdges(mixedBlock).ok, "tryReadEdges mixed protects");
check(!boardPropsReadable(mixedBlock), "mixed board is not writable");
check(readCards(mixedBlock).length === 0, "readCards mixed is empty");
check(readEdges(mixedBlock).length === 0, "readEdges mixed is empty");

const cardsMsg = formatProtectMessage(mixedCardResult, { ok: true, value: [] });
check(
  cardsMsg.includes("1") && cardsMsg.includes("cards"),
  "protect message names dropped cards",
);
const edgesMsg = formatProtectMessage({ ok: true, value: [] }, mixedEdgeResult);
check(
  edgesMsg.includes("1") && edgesMsg.includes("connections"),
  "protect message names dropped connections",
);
const bothMsg = formatProtectMessage(mixedCardResult, mixedEdgeResult);
check(
  bothMsg.includes("1") &&
    bothMsg.includes("cards") &&
    bothMsg.includes("connections"),
  "protect message names both dropped kinds",
);
const genericMsg = formatProtectMessage(
  { ok: false, reason: "not-array" },
  { ok: true, value: [] },
);
check(
  genericMsg.includes("could not be read") && !genericMsg.includes("1 cards"),
  "not-array uses the generic protect message",
);

// --- every item bad → protect ---

const allBadCards = [null, 1, { foo: true }];
const allBadCardResult = tryParseCards(allBadCards);
check(!isOk(allBadCardResult), "all-bad cards protect");
check(
  isDropped(allBadCardResult) && allBadCardResult.dropped === 3,
  "all-bad cards dropped count is 3",
);

const allBadEdges = [{}, "x", { to: 2 }];
const allBadEdgeResult = tryParseEdges(allBadEdges);
check(!isOk(allBadEdgeResult), "all-bad edges protect");
check(
  isDropped(allBadEdgeResult) && allBadEdgeResult.dropped === 3,
  "all-bad edges dropped count is 3",
);
check(
  !boardPropsReadable(board(allBadCards, "[]")),
  "all-bad cards protect the board",
);
check(
  !boardPropsReadable(board("[]", allBadEdges)),
  "all-bad edges protect the board",
);

console.log("cards.test.ts ok");
