import {
  operableCards,
} from "./areaChrome.ts";
import {
  collectTaggedHits,
  filterIsActive,
  formatFilterStatus,
  matchedCardIds,
  normalizeTagName,
  operableCardsForView,
  unmatchedCardIds,
  uniqueTagNames,
} from "./cardFilter.ts";
import type { WhiteboardArea } from "./areas.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

check(normalizeTagName("  #项目  ") === "项目", "strips hash and space");
check(normalizeTagName("project") === "project", "plain name stays");
check(normalizeTagName("   ") === "", "blank becomes empty");
check(
  uniqueTagNames(["#项目", "项目", " 紧急 ", "#紧急"]).join(",") ===
    "项目,紧急",
  "unique tags keep first casing",
);
check(filterIsActive({ tags: [] }) === false, "empty query is inactive");
check(filterIsActive({ tags: ["  ", "#"] }) === false, "blank tags inactive");
check(filterIsActive({ tags: ["项目"] }) === true, "named tag is active");

const cardIds = new Set([1, 2, 3, 4]);
const parentOf = (id: number) =>
  id === 11 ? 1 : id === 22 ? 2 : id === 33 ? 99 : null;

const none = matchedCardIds(cardIds, { tags: [] }, [11, 22], parentOf);
check(none.size === 4, "inactive filter matches every card");
check([...none].sort().join(",") === "1,2,3,4", "inactive keeps all ids");

const tagged = matchedCardIds(
  cardIds,
  { tags: ["项目"] },
  [11, 22, 3, 33],
  parentOf,
);
check(tagged.has(1), "child hit 11 walks to card 1");
check(tagged.has(2), "child hit 22 walks to card 2");
check(tagged.has(3), "direct card id 3 matches");
check(!tagged.has(4), "untagged card 4 does not match");
check(!tagged.has(33 as never), "hit whose parent is off-board is dropped");

const hidden = unmatchedCardIds([1, 2, 3, 4], tagged, true);
check(hidden.has(4) && !hidden.has(1), "unmatched is the inverse of matched");
check(
  unmatchedCardIds([1, 2, 3, 4], tagged, false).size === 0,
  "inactive filter hides nobody",
);
check(
  unmatchedCardIds([1, 4], new Set(), true).has(1) &&
    unmatchedCardIds([1, 4], new Set(), true).has(4),
  "cards with unknown tags are unmatched",
);

const frame: WhiteboardArea = {
  id: "area-1",
  name: "S",
  x: 0,
  y: 0,
  w: 200,
  h: 200,
  collapsed: true,
};
const inside = { blockId: 1, x: 10, y: 10, w: 40, h: 40 };
const flush = { blockId: 2, x: 0, y: 0, w: 200, h: 200 };
const straddle = { blockId: 3, x: 150, y: 150, w: 80, h: 80 };
const outside = { blockId: 4, x: 300, y: 300, w: 40, h: 40 };
const board = [inside, flush, straddle, outside];

const filterOnly = unmatchedCardIds(
  [1, 2, 3, 4],
  new Set([1, 4]),
  true,
);
const afterFilter = operableCardsForView([], board, filterOnly);
check(
  afterFilter.map((card) => card.blockId).join(",") === "1,4",
  "filter-only operable set is the matched cards",
);

const afterCollapse = operableCards([frame], board);
check(
  afterCollapse.map((card) => card.blockId).join(",") === "3,4",
  "collapse-only operable set hides area members",
);

const both = operableCardsForView([frame], board, filterOnly);
check(
  both.map((card) => card.blockId).join(",") === "4",
  "collapsed + unmatched leaves only the card that is neither",
);
check(
  !both.some((card) => card.blockId === 1),
  "matched-but-collapsed card is not operable",
);
check(
  !both.some((card) => card.blockId === 3),
  "unmatched-but-expanded card is not operable",
);
check(
  both.some((card) => card.blockId === 4),
  "matched and not collapsed stays operable",
);

const persistBefore = board.map((card) => ({ ...card }));
operableCardsForView([frame], board, filterOnly);
check(
  board.length === persistBefore.length &&
    board.every(
      (card, i) =>
        card.blockId === persistBefore[i].blockId &&
        card.x === persistBefore[i].x,
    ),
  "operable merge does not strip the persist source",
);

const collected = collectTaggedHits([
  [{ id: 11, parent: 1 }, 4],
  [{ id: 4 }, { id: 11, parent: 1 }],
]);
check(collected.ids.join(",") === "11,4", "tagged hits de-dupe across calls");
check(collected.parents.get(11) === 1, "parent map keeps the walk edge");

const label = formatFilterStatus({
  tags: ["项目", "#项目"],
  matched: 12,
  total: 87,
});
check(label.includes("#项目"), "status names the tag");
check(label.includes("12"), "status shows matched count");
check(label.includes("87"), "status shows total count");

console.log("cardFilter.test.ts ok");
