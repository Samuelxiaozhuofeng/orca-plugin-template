import {
  collapsedAreaHideSets,
  hiddenCardIdsInCollapsedAreas,
  mergePreservingHidden,
  operableCards,
  planAreaCollapsed,
  planAreaColor,
} from "./areaChrome.ts";
import {
  hitAreaAt,
  planAreaMove,
  preparedAreas,
  tryParseAreas,
  type WhiteboardArea,
} from "./areas.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function area(
  id: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return { id, x: 10, y: 20, w: 240, h: 160, name: "Section", ...extra };
}

function isOk<T>(
  result: { ok: true; value: T } | { ok: false },
): result is { ok: true; value: T } {
  return result.ok;
}

const legacy = tryParseAreas([area("area-1")]);
check(isOk(legacy) && legacy.value.length === 1, "legacy area parses");
check(
  isOk(legacy) && legacy.value[0].color === undefined,
  "legacy missing color is colourless",
);
check(
  isOk(legacy) && legacy.value[0].collapsed === undefined,
  "legacy missing collapsed is expanded",
);
check(
  isOk(legacy) && !("color" in legacy.value[0]),
  "legacy parse omits color key",
);
check(
  isOk(legacy) && !("collapsed" in legacy.value[0]),
  "legacy parse omits collapsed key",
);

const storedLegacy = preparedAreas(legacy.ok ? legacy.value : []);
check(!("color" in storedLegacy[0]), "write omits unset color");
check(!("collapsed" in storedLegacy[0]), "write omits expanded flag");

const hotpink = tryParseAreas([area("area-1", { color: "hotpink" })]);
check(isOk(hotpink), "invalid color does not protect the board");
check(
  isOk(hotpink) && hotpink.value[0].color === undefined,
  "invalid color is dropped",
);
check(
  isOk(hotpink) && hotpink.value[0].id === "area-1",
  "area with invalid color is still kept",
);

const numericColor = tryParseAreas([area("area-1", { color: 3 })]);
check(isOk(numericColor), "non-string color does not protect");
check(
  isOk(numericColor) && numericColor.value[0].color === undefined,
  "non-string color is dropped",
);

const defaultColor = tryParseAreas([area("area-1", { color: "default" })]);
check(
  isOk(defaultColor) && defaultColor.value[0].color === undefined,
  "default color is stored as no colour",
);

const blue = tryParseAreas([area("area-1", { color: "blue" })]);
check(isOk(blue) && blue.value[0].color === "blue", "valid color is kept");
const storedBlue = preparedAreas(blue.ok ? blue.value : []);
check(storedBlue[0].color === "blue", "write keeps an explicit color");

const folded = tryParseAreas([area("area-1", { collapsed: true })]);
check(
  isOk(folded) && folded.value[0].collapsed === true,
  "collapsed true is kept",
);

const collapsedStr = tryParseAreas([area("area-1", { collapsed: "yes" })]);
check(isOk(collapsedStr), "invalid collapsed does not protect");
check(
  isOk(collapsedStr) && collapsedStr.value[0].collapsed === undefined,
  "invalid collapsed is treated as expanded",
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
const hidden = hiddenCardIdsInCollapsedAreas(
  [frame],
  [inside, flush, straddle, outside],
);
check(
  hitAreaAt(50, 50, [frame]) == null,
  "collapsed interior is not a canvas hit",
);
check(hidden.has(1), "fully inside card is hidden");
check(hidden.has(2), "flush-against-border card is hidden");
check(!hidden.has(3), "card that only touches the border is not a member");
check(!hidden.has(4), "outside card is not hidden");

const openFrame = { ...frame };
delete openFrame.collapsed;
const noneHidden = hiddenCardIdsInCollapsedAreas(
  [openFrame],
  [inside, flush, straddle, outside],
);
check(noneHidden.size === 0, "expanded area hides no cards");

const edges = [
  { id: "in-in", from: 1, to: 2 },
  { id: "in-out", from: 1, to: 4 },
  { id: "out-out", from: 4, to: 4 },
  { id: "straddle-in", from: 3, to: 1 },
];
const hide = collapsedAreaHideSets(
  [frame],
  [inside, flush, straddle, outside],
  edges,
);
check(hide.edgeIds.has("in-in"), "edge wholly inside collapsed area is hidden");
check(
  !hide.edgeIds.has("in-out"),
  "edge that leaves the collapsed area stays",
);
check(!hide.edgeIds.has("out-out"), "outside edge stays");
check(
  !hide.edgeIds.has("straddle-in"),
  "edge to a border-straddling card stays",
);

const colored: WhiteboardArea[] = [
  { id: "area-1", name: "S", x: 0, y: 0, w: 10, h: 10 },
];
const painted = planAreaColor(colored, "area-1", "green");
check(painted != null && painted[0].color === "green", "plan sets a color");
const cleared = planAreaColor(painted ?? colored, "area-1", undefined);
check(
  cleared != null && !("color" in cleared[0]),
  "clearing color drops the field",
);
check(planAreaColor(colored, "area-1", "hotpink") == null, "invalid color is a no-op");

const foldedPlan = planAreaCollapsed(colored, "area-1", true);
check(
  foldedPlan != null && foldedPlan[0].collapsed === true,
  "plan collapses an area",
);
const opened = planAreaCollapsed(foldedPlan ?? colored, "area-1", false);
check(
  opened != null && !("collapsed" in opened[0]),
  "expanding drops the collapsed field",
);

const persistCards = [inside, flush, straddle, outside];
const persistBefore = persistCards.map((card) => ({ ...card }));
const interactive = operableCards([frame], persistCards);
check(
  interactive.map((card) => card.blockId).join(",") === "3,4",
  "hidden cards are not in the operable set",
);
check(
  persistCards.length === persistBefore.length &&
    persistCards.every(
      (card, i) =>
        card.blockId === persistBefore[i].blockId &&
        card.x === persistBefore[i].x,
    ),
  "operableCards does not strip cards from the persist source",
);

const nudged = interactive.map((card) =>
  card.blockId === 4 ? { ...card, x: 999 } : card,
);
const afterNudge = mergePreservingHidden(persistCards, nudged);
check(afterNudge.length === 4, "merge keeps every persist card");
check(
  afterNudge.find((card) => card.blockId === 1)?.x === 10 &&
    afterNudge.find((card) => card.blockId === 2)?.x === 0,
  "hidden cards stay in the persist list at their old positions",
);
check(
  afterNudge.find((card) => card.blockId === 4)?.x === 999,
  "operable edits are kept",
);

const dragged = planAreaMove(frame, 10, 0, persistCards, [frame]);
const afterDrag = mergePreservingHidden(persistCards, dragged.cards);
check(
  afterDrag.find((card) => card.blockId === 1)?.x === 20 &&
    afterDrag.find((card) => card.blockId === 2)?.x === 10,
  "dragging the collapsed area still moves its hidden members",
);
check(
  afterDrag.find((card) => card.blockId === 3)?.x === 150,
  "straddling card is not an area member",
);
check(afterDrag.length === persistCards.length, "area drag does not drop cards");

console.log("areaChrome.test.ts ok");
