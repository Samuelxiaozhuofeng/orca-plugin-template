import {
  CARD_HEIGHT,
  CARD_WIDTH,
  GRID_GAP,
  GRID_ORIGIN,
  layoutGrid,
} from "./layout.ts";
import {
  applyPageBoardCacheForget,
  applyPageBoardCacheRemember,
  chunkIds,
  collectBlockViewRoots,
  collectLiveRedirectKeys,
  forgetPageBoardId,
  GET_BLOCKS_BATCH_SIZE,
  idsMissingFromBlocks,
  isInlineWhiteboardBlock,
  isPageBoardIdCacheFresh,
  isPageWhiteboardBlock,
  isTruthyFlagValue,
  isWhiteboardBlock,
  numberedAlias,
  PAGE_BOARD_COLUMNS,
  PAGE_BOARD_ID_CACHE_TTL_MS,
  panelIsBlockViewRoot,
  planChildCards,
  planTurnIntoCards,
  pruneRedirectKeys,
  redirectKey,
  rememberPageBoardId,
  reprType,
  shouldAutoOpenInlineRoot,
  shouldAutoOpenPageBoard,
  WHITEBOARD_PAGE_PROP,
} from "./pageBoardPlan.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

check(numberedAlias("Untitled whiteboard", 1) === "Untitled whiteboard", "first alias has no suffix");
check(
  numberedAlias("Untitled whiteboard", 2) === "Untitled whiteboard 2",
  "second alias gets a number",
);
check(
  numberedAlias("Untitled whiteboard", 10) === "Untitled whiteboard 10",
  "double-digit suffix",
);

{
  const ids = [11, 22, 33, 44, 55];
  const cards = planChildCards(ids, 99);
  check(cards.length === 5, "every first-level child becomes a card");
  check(
    cards.every((card) => card.kind === "block"),
    "converted cards are block kind",
  );
  for (let i = 0; i < cards.length; i++) {
    const expected = layoutGrid(i, PAGE_BOARD_COLUMNS, {
      x: GRID_ORIGIN,
      y: GRID_ORIGIN,
    });
    check(cards[i].blockId === ids[i], `card ${i} keeps child order`);
    check(cards[i].x === expected.x && cards[i].y === expected.y, `card ${i} uses layoutGrid`);
    check(cards[i].w === CARD_WIDTH && cards[i].h === CARD_HEIGHT, `card ${i} uses default size`);
  }
  const cell = CARD_WIDTH + GRID_GAP;
  check(cards[4].x === GRID_ORIGIN + 0 * cell, "fifth card wraps to next row");
  check(cards[4].y === GRID_ORIGIN + 1 * (CARD_HEIGHT + GRID_GAP), "fifth card is on row 2");
}

check(
  planChildCards([7, 7, 8], 7).map((card) => card.blockId).join(",") === "8",
  "skips the board itself and duplicate children",
);

{
  const existing = planChildCards([1, 2]);
  const keep = planTurnIntoCards(existing, [9, 10], 0);
  check(keep.action === "keep", "non-empty cards are not overwritten");
  const write = planTurnIntoCards([], [9, 10], 0);
  check(write.action === "write", "empty cards get a grid from children");
  if (write.action === "write") {
    check(write.cards.map((card) => card.blockId).join(",") === "9,10", "write uses first-level children");
  }
}

{
  const inline = {
    properties: [{ name: "_repr", value: { type: "whiteboard.canvas" } }],
  };
  const text = { properties: [{ name: "_repr", value: { type: "text" } }] };
  const heading = { properties: [{ name: "_repr", value: { type: "heading" } }] };
  const page = {
    properties: [
      { name: "_repr", value: { type: "text" } },
      { name: WHITEBOARD_PAGE_PROP, value: true },
    ],
  };
  const pageNumeric = {
    properties: [{ name: WHITEBOARD_PAGE_PROP, value: 1 }],
  };
  const turnedBack = {
    properties: [
      { name: "_repr", value: { type: "heading" } },
      { name: WHITEBOARD_PAGE_PROP, value: 0 },
    ],
  };
  check(isInlineWhiteboardBlock(inline) === true, "inline _repr is detected");
  check(isPageWhiteboardBlock(inline) === false, "inline type is not a page flag");
  check(isWhiteboardBlock(inline) === true, "inline counts as a whiteboard");
  check(isWhiteboardBlock(text) === false, "text _repr is not a whiteboard");
  check(isWhiteboardBlock({}) === false, "missing _repr is not a whiteboard");
  check(reprType(inline) === "whiteboard.canvas", "reprType reads _repr.type");
  check(isPageWhiteboardBlock(page) === true, "true flag is a page whiteboard");
  check(isInlineWhiteboardBlock(page) === false, "page flag does not change type");
  check(isWhiteboardBlock(page) === true, "page flag counts as a whiteboard");
  check(isPageWhiteboardBlock(pageNumeric) === true, "numeric 1 flag is true");
  check(isPageWhiteboardBlock(turnedBack) === false, "0 flag is not a page whiteboard");
  check(isWhiteboardBlock(turnedBack) === false, "turned-back heading is not a whiteboard");
  check(isWhiteboardBlock(heading) === false, "heading without flag is not a whiteboard");
}

check(isTruthyFlagValue(true) === true, "boolean true");
check(isTruthyFlagValue(1) === true, "numeric 1");
check(isTruthyFlagValue("true") === true, "string true");
check(isTruthyFlagValue("1") === true, "string 1");
check(isTruthyFlagValue(false) === false, "boolean false");
check(isTruthyFlagValue(0) === false, "numeric 0");
check(isTruthyFlagValue("false") === false, "string false");
check(isTruthyFlagValue(undefined) === false, "undefined is false");
check(WHITEBOARD_PAGE_PROP === "whiteboardPage", "stable marker name");

check(
  panelIsBlockViewRoot({ view: "block", viewArgs: { blockId: 42 } }, 42) === true,
  "root of a block view matches",
);
check(
  panelIsBlockViewRoot({ view: "block", viewArgs: { blockId: 1 } }, 42) === false,
  "inline whiteboard is not the panel root",
);
check(
  panelIsBlockViewRoot({ view: "whiteboard.board", viewArgs: { blockId: 42 } }, 42) ===
    false,
  "already-canvas panel does not match block-view root",
);
check(
  panelIsBlockViewRoot({ view: "journal", viewArgs: {} }, 42) === false,
  "journal panel is not a block-view root",
);

check(
  shouldAutoOpenPageBoard({
    settingOn: true,
    suppressed: false,
    isPageWhiteboard: true,
  }) === true,
  "page board auto-opens when setting is on",
);
check(
  shouldAutoOpenPageBoard({
    settingOn: false,
    suppressed: false,
    isPageWhiteboard: true,
  }) === false,
  "setting off disables page auto-open",
);
check(
  shouldAutoOpenPageBoard({
    settingOn: true,
    suppressed: true,
    isPageWhiteboard: true,
  }) === false,
  "outline suppress blocks page auto-open",
);
check(
  shouldAutoOpenPageBoard({
    settingOn: true,
    suppressed: false,
    isPageWhiteboard: false,
  }) === false,
  "plain page does not auto-open",
);

check(
  shouldAutoOpenInlineRoot({
    settingOn: true,
    suppressed: false,
    isInlineWhiteboard: true,
    isPanelRoot: true,
  }) === true,
  "inline root still auto-opens",
);
check(
  shouldAutoOpenInlineRoot({
    settingOn: true,
    suppressed: false,
    isInlineWhiteboard: true,
    isPanelRoot: false,
  }) === false,
  "inline block in the middle of an outline does not auto-open",
);
check(
  shouldAutoOpenInlineRoot({
    settingOn: true,
    suppressed: true,
    isInlineWhiteboard: true,
    isPanelRoot: true,
  }) === false,
  "outline suppress also applies to inline roots",
);

{
  const tree = {
    children: [
      { id: "p1", view: "block", viewArgs: { blockId: 10 } },
      { id: "p2", view: "whiteboard.board", viewArgs: { blockId: 11 } },
      { id: "p3", view: "journal", viewArgs: {} },
      {
        children: [
          { id: "p4", view: "block", viewArgs: { blockId: 12 } },
          { id: "p5", view: "block", viewArgs: { blockId: "nope" } },
        ],
      },
    ],
  };
  const roots = collectBlockViewRoots(tree);
  check(
    roots.map((item) => `${item.panelId}:${item.blockId}`).join(",") === "p1:10,p4:12",
    "only block-view panel roots are collected",
  );
  const live = collectLiveRedirectKeys(tree);
  check(live.has(redirectKey("p1", 10)), "outline root is live");
  check(live.has(redirectKey("p2", 11)), "canvas of the same visit stays live");
  check(live.has(redirectKey("p4", 12)), "nested block view is live");
  check(live.has(redirectKey("p3", 0)) === false, "journal without blockId is not live");
}

{
  const stored = new Set([redirectKey("p1", 10), redirectKey("p2", 11)]);
  pruneRedirectKeys(stored, new Set([redirectKey("p1", 10)]));
  check(stored.has(redirectKey("p1", 10)), "still-live suppress stays");
  check(stored.has(redirectKey("p2", 11)) === false, "left panel/block drops suppress");
}

check(PAGE_BOARD_ID_CACHE_TTL_MS === 60_000, "page-board id cache TTL is 60s");
check(GET_BLOCKS_BATCH_SIZE === 200, "get-blocks batch size is 200");
check(isPageBoardIdCacheFresh(null, 1_000) === false, "empty cache is not fresh");
check(
  isPageBoardIdCacheFresh({ ids: [1], fetchedAt: 0 }, 59_999) === true,
  "cache is fresh inside TTL",
);
check(
  isPageBoardIdCacheFresh({ ids: [1], fetchedAt: 0 }, 60_000) === false,
  "cache is stale at TTL",
);
check(
  rememberPageBoardId([1, 2], 3).join(",") === "1,2,3",
  "remember appends a new id",
);
check(
  rememberPageBoardId([1, 2], 2).join(",") === "1,2",
  "remember is a no-op for an existing id",
);
check(forgetPageBoardId([1, 2, 3], 2).join(",") === "1,3", "forget removes one id");

{
  const fresh = { ids: [10, 11], fetchedAt: 1_000 };
  const remembered = applyPageBoardCacheRemember(fresh, 12, 1_500);
  check(
    remembered != null && remembered.ids.join(",") === "10,11,12",
    "fresh cache accepts a newly marked page",
  );
  check(
    remembered != null && remembered.fetchedAt === 1_000,
    "remember does not refresh TTL",
  );
  check(
    applyPageBoardCacheRemember({ ids: [], fetchedAt: 1_000 }, 5, 1_100)
      ?.ids.join(",") === "5",
    "empty fresh cache accepts the first newly marked page",
  );
  check(
    applyPageBoardCacheRemember(null, 12, 1_500) === null,
    "remember does not seed a singleton cache",
  );
  const stale = applyPageBoardCacheRemember({ ids: [10], fetchedAt: 0 }, 12, 60_000);
  check(
    stale != null && stale.ids.join(",") === "10",
    "stale cache is not mutated by remember",
  );
  const forgotten = applyPageBoardCacheForget(fresh, 11);
  check(
    forgotten != null && forgotten.ids.join(",") === "10",
    "forget drops the turned-back page",
  );
  check(applyPageBoardCacheForget(null, 11) === null, "forget on empty cache is null");
}

check(
  idsMissingFromBlocks([1, 2, 3], { 2: { id: 2 } }).join(",") === "1,3",
  "only unloaded ids are missing",
);
check(
  chunkIds([1, 2, 3, 4, 5], 2)
    .map((batch) => batch.join(","))
    .join("|") === "1,2|3,4|5",
  "ids are chunked without overlap",
);
check(chunkIds([], 200).length === 0, "empty id list chunks to nothing");

console.log("pageBoard.test.ts: ok");
