import { CARD_LOD_SCALE, CARD_MOUNT_CAP, MIN_SCALE } from "./layout.ts";
import {
  CARD_TREE_LOAD_MAX_DEPTH,
  CARD_TREE_LOAD_MAX_NODES,
  cardTreeLoadIds,
  planCardTreeQueue,
} from "./cardTreeLoad.ts";
import {
  cachedBlockPlainText,
  collectBlockTreeIds,
  isLodSimplified,
  marginScreensForScale,
  pickMountedCards,
  planShownCards,
  visibleCards,
  type CanvasView,
} from "./viewTransform.ts";
import type { WhiteboardCard } from "./cards.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function card(
  blockId: number,
  x: number,
  y = 0,
  w = 100,
  h = 80,
): WhiteboardCard {
  return { blockId, kind: "block", x, y, w, h };
}

const viewport = { width: 800, height: 600 };

function viewAt(scale: number, x = 0, y = 0): CanvasView {
  return { x, y, scale };
}

check(CARD_LOD_SCALE === 0.5, "LOD threshold is 50%");
check(CARD_MOUNT_CAP === 300, "mount cap is 300");

check(isLodSimplified(1) === false, "100% is full render");
check(isLodSimplified(CARD_LOD_SCALE) === false, "threshold itself is full");
check(isLodSimplified(CARD_LOD_SCALE - 0.01) === true, "just below is simplified");
check(isLodSimplified(MIN_SCALE) === true, "min zoom is simplified");
check(isLodSimplified(2) === false, "max zoom is full");

const marginScales = [2, 1, 0.8, 0.6, 0.5, 0.4, 0.3, MIN_SCALE, 0.1];
let prevMargin = Number.POSITIVE_INFINITY;
for (const scale of marginScales) {
  const margin = marginScreensForScale(scale);
  check(
    margin <= prevMargin + 1e-12,
    `marginScreens at ${scale} (${margin}) is not larger than at a higher zoom (${prevMargin})`,
  );
  prevMargin = margin;
}
check(marginScreensForScale(MIN_SCALE) === 0, "no extra screen at min zoom");
check(marginScreensForScale(1) === 1, "full pad at 100%");
check(marginScreensForScale(2) === 1, "pad stays 1 above 100%");
check(
  Math.abs(marginScreensForScale(0.625) - 0.5) < 1e-12,
  "mid zoom interpolates (0.625 → 0.5 screens)",
);

const justPastAtFull = card(1, viewport.width / 1 + 50);
const justPastAtMin = card(1, viewport.width / MIN_SCALE + 50);
check(
  visibleCards([justPastAtFull], viewAt(1), viewport, null).length === 1,
  "100% still prefetches a card just past the edge",
);
check(
  visibleCards([justPastAtMin], viewAt(MIN_SCALE), viewport, null).length === 0,
  "min zoom does not prefetch past the edge",
);

const halfScreenPast = card(2, (viewport.width * 1.5) / 0.5);
check(
  visibleCards([halfScreenPast], viewAt(0.5), viewport, null).length === 0,
  "at 50% a card 0.5 screens out is outside the tighter pad",
);
check(
  visibleCards([halfScreenPast], viewAt(0.5), viewport, [2]).length === 1,
  "pinned cards stay visible even outside the pad",
);

const many = [1, 2, 3, 4, 5].map((id, i) => card(id, i * 200));
const capped = pickMountedCards(many, { cap: 3 });
check(capped.cards.length === 3, "cap trims to 3");
check(capped.hiddenCount === 2, "hidden count is the overflow");

const keepLast = pickMountedCards(many, { cap: 3, editingId: 5 });
check(
  keepLast.cards.some((item) => item.blockId === 5),
  "editing card is kept when over cap",
);
check(keepLast.cards.length === 3, "editing keep still respects the cap for others");
check(keepLast.hiddenCount === 2, "hidden count after keeping editor");

const preferSelected = pickMountedCards(many, {
  cap: 2,
  editingId: 5,
  selectedIds: [1],
});
check(
  preferSelected.cards.map((item) => item.blockId).sort().join(",") === "1,5",
  "editing + selected fill the cap before the rest",
);

const under = pickMountedCards(many, { cap: 10 });
check(under.cards.length === 5 && under.hiddenCount === 0, "under cap keeps all");

const nearest = pickMountedCards(
  [card(1, 0), card(2, 9000), card(3, 350), card(4, 8000)],
  {
    cap: 2,
    view: viewAt(1),
    viewport,
  },
);
check(
  nearest.cards.map((item) => item.blockId).join(",") === "3,1",
  "uncapped overflow prefers cards nearest the viewport centre",
);

check(
  cardTreeLoadIds(many).join(",") === "1,2,3,4,5",
  "full zoom loads every shown card",
);
check(
  cardTreeLoadIds(many, { simplified: true }).length === 0,
  "simplified cards are not loaded",
);
check(
  cardTreeLoadIds(many, { simplified: true, keep: 4 }).join(",") === "4",
  "only the editing card loads in simplified mode",
);
check(
  cardTreeLoadIds(many, { simplified: true, keep: 99 }).length === 0,
  "keep id not in shown list loads nothing",
);

const lodPlan = planCardTreeQueue(many, {}, {
  retryable: new Set([1, 2, 3]),
  simplified: true,
});
check(lodPlan.queue.length === 0, "lod queue stays empty even after failures");
check(
  lodPlan.failedRoots.length === 0,
  "lod does not surface load-failure state",
);

const manySpread: WhiteboardCard[] = [];
for (let i = 0; i < 1000; i++) {
  manySpread.push(
    card(i + 1, (i % 40) * 400, Math.floor(i / 40) * 300),
  );
}
const allIds = manySpread.map((item) => item.blockId);
const shownViewport = planShownCards(manySpread, viewAt(1), viewport);
const pinnedIfSelected = visibleCards(manySpread, viewAt(1), viewport, allIds);
check(
  pinnedIfSelected.length === 1000,
  "old pin-selected path would keep every card",
);
check(
  shownViewport.cards.length < 80,
  `select-all mount set stays viewport-sized (got ${shownViewport.cards.length})`,
);
check(
  shownViewport.cards.length <= CARD_MOUNT_CAP,
  "mount set never exceeds the cap",
);
check(
  shownViewport.cards.every((item) =>
    visibleCards([item], viewAt(1), viewport, null).length === 1,
  ),
  "every mounted card intersects the viewport",
);
const shownAgain = planShownCards(manySpread, viewAt(1), viewport, {
  editingId: null,
});
check(
  shownAgain.cards.map((item) => item.blockId).join(",") ===
    shownViewport.cards.map((item) => item.blockId).join(","),
  "selection size is not an input to the mount set",
);

const farEdit = card(9001, 50_000, 50_000);
const withEditor = planShownCards([...manySpread, farEdit], viewAt(1), viewport, {
  editingId: 9001,
});
check(
  withEditor.cards.some((item) => item.blockId === 9001),
  "the card being edited stays mounted even off-screen",
);

const deep: Record<number, { children: number[]; text: string }> = {};
for (let i = 1; i <= 20; i++) {
  deep[i] = { children: i < 20 ? [i + 1] : [], text: i === 20 ? "leaf" : "" };
}
const watchIds = collectBlockTreeIds(
  [1],
  deep,
  CARD_TREE_LOAD_MAX_NODES,
  CARD_TREE_LOAD_MAX_DEPTH,
);
check(watchIds.length === CARD_TREE_LOAD_MAX_DEPTH + 1, "watch depth matches load cap");
check(
  watchIds[watchIds.length - 1] === CARD_TREE_LOAD_MAX_DEPTH + 1,
  "watch walk stops at the load depth cap",
);
check(
  cachedBlockPlainText(1, deep, CARD_TREE_LOAD_MAX_NODES, CARD_TREE_LOAD_MAX_DEPTH) ===
    "",
  "excerpt does not walk past the load cap to a distant leaf",
);
check(
  cachedBlockPlainText(1, deep) === "leaf",
  "default excerpt depth still reaches a depth-19 leaf",
);

console.log("viewLod.test.ts ok");
