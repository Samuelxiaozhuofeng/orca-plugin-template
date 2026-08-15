import { boardPropsReadable } from "./boardWrite.ts";
import {
  edgesEqual,
  normalizeEdge,
  parseEdges,
  planEdgeColor,
  planEdgeStyle,
  preparedEdges,
  tryParseEdges,
  tryReadEdges,
  type WhiteboardEdge,
} from "./edges.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function edge(
  from: number,
  to: number,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return { id: `${from}-${to}-1`, from, to, arrow: "end", ...extra };
}

function board(edges?: unknown) {
  const properties: Array<{ name: string; value?: unknown }> = [];
  if (arguments.length >= 1) properties.push({ name: "edges", value: edges });
  return { properties };
}

function isOk<T>(
  result: { ok: true; value: T } | { ok: false },
): result is { ok: true; value: T } {
  return result.ok;
}

const legacy = tryParseEdges([edge(1, 2)]);
check(isOk(legacy) && legacy.value.length === 1, "legacy edge parses");
check(
  isOk(legacy) && legacy.value[0].color === undefined,
  "legacy missing color is default",
);
check(
  isOk(legacy) && legacy.value[0].style === undefined,
  "legacy missing style is solid",
);
check(
  isOk(legacy) && !("color" in legacy.value[0]),
  "legacy parse omits color key",
);
check(
  isOk(legacy) && !("style" in legacy.value[0]),
  "legacy parse omits style key",
);

const storedLegacy = preparedEdges(legacy.ok ? legacy.value : []);
check(!("color" in storedLegacy[0]), "write omits unset color");
check(!("style" in storedLegacy[0]), "write omits unset style");
check(
  !JSON.stringify(storedLegacy).includes('"color"'),
  "legacy JSON has no color field",
);
check(
  !JSON.stringify(storedLegacy).includes('"style"'),
  "legacy JSON has no style field",
);

const hotpink = tryParseEdges([edge(1, 2, { color: "hotpink" })]);
check(isOk(hotpink), "invalid color does not protect the board");
check(
  isOk(hotpink) && hotpink.value[0].color === undefined,
  "invalid color is dropped",
);
check(
  isOk(hotpink) && hotpink.value[0].id === "1-2-1",
  "edge with invalid color is still kept",
);

const numericColor = tryParseEdges([edge(1, 2, { color: 3 })]);
check(isOk(numericColor), "non-string color does not protect");
check(
  isOk(numericColor) && numericColor.value[0].color === undefined,
  "non-string color is dropped",
);

const defaultColor = tryParseEdges([edge(1, 2, { color: "default" })]);
check(
  isOk(defaultColor) && defaultColor.value[0].color === undefined,
  "default color is stored as no colour",
);

const blue = tryParseEdges([edge(1, 2, { color: "blue" })]);
check(isOk(blue) && blue.value[0].color === "blue", "valid color is kept");
const storedBlue = preparedEdges(blue.ok ? blue.value : []);
check(storedBlue[0].color === "blue", "write keeps an explicit color");

const dotted = tryParseEdges([edge(1, 2, { style: "dotted" })]);
check(isOk(dotted), "invalid style does not protect the board");
check(
  isOk(dotted) && dotted.value[0].style === undefined,
  "invalid style is dropped",
);

const solidStored = tryParseEdges([edge(1, 2, { style: "solid" })]);
check(
  isOk(solidStored) && solidStored.value[0].style === undefined,
  "solid style is stored as no field",
);

const numericStyle = tryParseEdges([edge(1, 2, { style: 1 })]);
check(isOk(numericStyle), "non-string style does not protect");
check(
  isOk(numericStyle) && numericStyle.value[0].style === undefined,
  "non-string style is dropped",
);

const dashed = tryParseEdges([edge(1, 2, { style: "dashed" })]);
check(isOk(dashed) && dashed.value[0].style === "dashed", "dashed is kept");
const storedDashed = preparedEdges(dashed.ok ? dashed.value : []);
check(storedDashed[0].style === "dashed", "write keeps an explicit dash");

check(
  boardPropsReadable(board([edge(1, 2, { color: "hotpink", style: "zigzag" })])),
  "junk color/style leave the board readable",
);
check(
  boardPropsReadable(board([edge(1, 2)])),
  "legacy edge without new fields stays readable",
);
check(isOk(tryReadEdges(board([edge(1, 2, { color: "nope" })]))), "tryRead junk color is ok");

check(parseEdges([edge(1, 2, { color: "nope" })]).length === 1, "parse keeps the edge");

const plain: WhiteboardEdge = {
  id: "1-2-1",
  from: 1,
  to: 2,
  arrow: "end",
};
const painted: WhiteboardEdge = { ...plain, color: "green" };
const dashedEdge: WhiteboardEdge = { ...plain, style: "dashed" };
check(!edgesEqual([plain], [painted]), "equality sees a new color");
check(!edgesEqual([plain], [dashedEdge]), "equality sees a new style");
check(edgesEqual([painted], [{ ...painted }]), "same color compares equal");
check(
  !edgesEqual([painted], [{ ...painted, color: "coral" }]),
  "different colors compare unequal",
);
check(
  !edgesEqual([dashedEdge], [painted]),
  "color vs style are not interchangeable",
);
check(
  edgesEqual(
    [{ ...plain, color: "blue", style: "dashed" }],
    [{ ...plain, color: "blue", style: "dashed" }],
  ),
  "same color+style compares equal",
);

const both = tryParseEdges([edge(1, 2, { color: "purple", style: "dashed" })]);
check(
  isOk(both) &&
    both.value[0].color === "purple" &&
    both.value[0].style === "dashed",
  "color and style can coexist",
);
const bothJson = JSON.stringify(preparedEdges(both.ok ? both.value : []));
check(bothJson.includes('"color":"purple"'), "write keeps color in JSON");
check(bothJson.includes('"style":"dashed"'), "write keeps style in JSON");

const base: WhiteboardEdge[] = [plain];
const paintedPlan = planEdgeColor(base, "1-2-1", "green");
check(paintedPlan != null && paintedPlan[0].color === "green", "plan sets a color");
const cleared = planEdgeColor(paintedPlan ?? base, "1-2-1", undefined);
check(cleared != null && !("color" in cleared[0]), "clearing color drops the field");
check(planEdgeColor(base, "1-2-1", "hotpink") == null, "invalid color is a no-op");
check(planEdgeColor(base, "1-2-1", "default") == null, "default color is a no-op on unset");

const dashPlan = planEdgeStyle(base, "1-2-1", "dashed");
check(dashPlan != null && dashPlan[0].style === "dashed", "plan sets dashed");
const solidPlan = planEdgeStyle(dashPlan ?? base, "1-2-1", "solid");
check(solidPlan != null && !("style" in solidPlan[0]), "solid drops the style field");
check(planEdgeStyle(base, "1-2-1", "solid") == null, "solid on unset is a no-op");
check(planEdgeStyle(base, "1-2-1", "dotted") == null, "invalid style is a no-op");

const normalized = normalizeEdge(edge(3, 4, { color: "default", style: "solid" }));
check(
  normalized != null && !("color" in normalized) && !("style" in normalized),
  "normalize omits default color and solid style",
);

console.log("edges.test.ts ok");
