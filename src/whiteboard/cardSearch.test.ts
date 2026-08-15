import {
  collectBlockIds,
  invokeFindCardOnActivePanel,
  mapSearchHitsToCardIds,
  matchCardDocs,
  mergeCardSearchHits,
  normalizeSearchQuery,
  registerFindCardAction,
  snippetAround,
  type CardSearchDoc,
} from "./cardSearch.ts";

function check(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function doc(
  id: number,
  title: string,
  body = "",
): CardSearchDoc {
  return { blockId: id, title, body };
}

check(normalizeSearchQuery("  Hello  ") === "hello", "query trims and lowercases");
check(normalizeSearchQuery("") === "", "empty query stays empty");

const docs = [
  doc(1, "Project plan", "kickoff next week"),
  doc(2, "Weekly review", "project status is green"),
  doc(3, "Random notes", "groceries"),
  doc(4, "plan", "short title match"),
];

check(matchCardDocs(docs, "").length === 0, "empty query matches nothing");
check(matchCardDocs(docs, "   ").length === 0, "whitespace query matches nothing");

const planHits = matchCardDocs(docs, "plan");
check(planHits.length === 2, "plan matches title hits");
check(planHits[0].blockId === 4, "exact title ranks first");
check(planHits[1].blockId === 1, "partial title ranks next");

const bodyHits = matchCardDocs(docs, "green");
check(bodyHits.length === 1, "body-only match");
check(bodyHits[0].blockId === 2, "body hit is weekly review");
check(bodyHits[0].score < 200, "body score is below title scores");

const prefixHits = matchCardDocs(docs, "week");
check(prefixHits[0].blockId === 2, "title prefix beats body");

const snippet = snippetAround("the project status is green today", "green");
check(snippet.toLowerCase().includes("green"), "snippet keeps the match");

const mapped = mapSearchHitsToCardIds(
  new Set([10, 20]),
  [99, 20, 88],
  (id) => (id === 99 ? 10 : id === 88 ? 77 : null),
);
check(mapped.length === 2, "maps root hit and parent hit");
check(mapped[0] === 10, "child 99 walks to card 10");
check(mapped[1] === 20, "direct card id is kept");

const walkedNone = mapSearchHitsToCardIds(new Set([1]), [2], () => 3);
check(walkedNone.length === 0, "unrelated hits stay off the board");

check(collectBlockIds([{ id: 1 }, 2, { id: 1 }, "x"]).join(",") === "1,2", "collect ids");

const cached = matchCardDocs(docs, "project");
const merged = mergeCardSearchHits(cached, [3, 1], docs);
check(merged.some((hit) => hit.blockId === 1), "cache hit kept");
check(merged.some((hit) => hit.blockId === 3), "remote-only id added");
const remoteOnly = merged.find((hit) => hit.blockId === 3);
check(remoteOnly != null && remoteOnly.score === 50, "remote-only scores below cache");
const cachedKeep = merged.find((hit) => hit.blockId === 1);
check(
  cachedKeep != null && cachedKeep.score > 50,
  "cache score is not overwritten by remote",
);

const g = globalThis as unknown as {
  orca?: { state: { activePanel: string } };
};
g.orca = { state: { activePanel: "panel-a" } };

let opened = 0;
const unreg = registerFindCardAction("wb-1", () => {
  opened += 1;
});

g.orca.state.activePanel = "outline";
invokeFindCardOnActivePanel();
check(opened === 0, "non-whiteboard panel does not open search");

g.orca.state.activePanel = "";
invokeFindCardOnActivePanel();
check(opened === 0, "empty active panel does not open search");

g.orca.state.activePanel = "wb-1";
invokeFindCardOnActivePanel();
check(opened === 1, "registered whiteboard panel opens search");

unreg();
invokeFindCardOnActivePanel();
check(opened === 1, "unregistered panel no longer opens search");

console.log("cardSearch tests passed");
