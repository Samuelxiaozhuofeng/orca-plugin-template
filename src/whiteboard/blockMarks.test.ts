// @ts-nocheck — Node assertion script; tsc has no @types/node in this package.
import { register } from "node:module";

const g = globalThis as typeof globalThis & {
  window: { Valtio: { subscribe: () => () => void; useSnapshot: () => object } };
};
g.window = {
  ...(g.window ?? {}),
  Valtio: {
    subscribe: () => () => {},
    useSnapshot: () => ({}),
  },
};

// Production files omit ".ts"; Node ESM will not resolve them otherwise.
register(
  `data:text/javascript,${encodeURIComponent(`
    export async function resolve(specifier, context, nextResolve) {
      try {
        return await nextResolve(specifier, context);
      } catch (err) {
        if (
          err?.code === "ERR_MODULE_NOT_FOUND" &&
          typeof specifier === "string" &&
          !specifier.endsWith(".ts") &&
          (specifier.startsWith(".") || specifier.startsWith("/"))
        ) {
          return nextResolve(specifier + ".ts", context);
        }
        throw err;
      }
    }
  `)}`,
  import.meta.url,
);

const {
  applyBoardCardIndex,
  buildBlockMarkCss,
  collectCardBoards,
  markLabelFor,
  OWB_MARK_ATTR,
  OWB_MARK_LABEL_ATTR,
} = await import("./blockMarks.ts");

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function cssRuleCount(css: string): number {
  return [...css.matchAll(/\{[^{}]*\}/g)].length;
}

function boardMap(count: number): Map<number, string[]> {
  const byBlock = new Map<number, string[]>();
  for (let i = 1; i <= count; i++) byBlock.set(i, ["Board"]);
  return byBlock;
}

function cardJson(blockId: number): string {
  return JSON.stringify([
    { blockId, kind: "block", x: 0, y: 0, w: 240, h: 160 },
  ]);
}

check(buildBlockMarkCss(new Map()) === "", "empty table yields no CSS");

const css10 = buildBlockMarkCss(boardMap(10));
const css100 = buildBlockMarkCss(boardMap(100));
const css1000 = buildBlockMarkCss(boardMap(1000));

check(css10.length > 0, "non-empty table yields CSS");
check(css10 === css100, "10 and 100 blocks share the same CSS");
check(css100 === css1000, "100 and 1000 blocks share the same CSS");
check(!css10.includes("[data-id="), "no per-block data-id selectors");
check(css10.includes(`[${OWB_MARK_ATTR}]`), "mark selector uses data-owb-mark");
check(
  css10.includes(`attr(${OWB_MARK_LABEL_ATTR})`),
  "tooltip reads data-owb-mark-label",
);
check(
  css10.includes(":has(> .orca-repr > .orca-repr-main:hover)"),
  "hover still uses host repr-main",
);
check(cssRuleCount(css10) === 4, `constant rule count (got ${cssRuleCount(css10)})`);
check(css10.includes("opacity: 0.55"), "idle mark opacity");
check(css10.includes("opacity: 1"), "hover mark opacity");
check(css10.includes("width: 12px"), "mark width");
check(css10.includes("height: 9px"), "mark height");

const collected = collectCardBoards([
  {
    aliases: ["Alpha"],
    properties: [
      {
        name: "cards",
        value: JSON.stringify([
          { blockId: 1, kind: "block", x: 0, y: 0, w: 240, h: 160 },
          { blockId: 2, kind: "block", x: 0, y: 0, w: 240, h: 160 },
          { blockId: 1, kind: "block", x: 10, y: 10, w: 240, h: 160 },
        ]),
      },
    ],
  },
  {
    aliases: ["Beta"],
    properties: [{ name: "cards", value: cardJson(1) }],
  },
  {
    aliases: ["Empty"],
    properties: [{ name: "cards", value: "[]" }],
  },
]);

check(collected.size === 2, "only blocks that appear on a board");
check(collected.get(1)?.join(",") === "Alpha,Beta", "multi-board names keep order");
check(collected.get(2)?.join(",") === "Alpha", "single-board name");
check(
  markLabelFor(collected.get(1)) === "On 2 whiteboards",
  "multi-board tooltip",
);
check(
  markLabelFor(collected.get(2)) === 'On the "Alpha" whiteboard',
  "single-board tooltip",
);
check(markLabelFor(undefined) === null, "missing names are unmarked");
check(markLabelFor([]) === null, "empty names are unmarked");

const incremental = new Map();
applyBoardCardIndex(incremental, null, { name: "Alpha", cardIds: [1, 2] });
applyBoardCardIndex(incremental, null, { name: "Beta", cardIds: [1] });
check(
  incremental.get(1)?.join(",") === "Alpha,Beta",
  "incremental add keeps cross-board names",
);
applyBoardCardIndex(
  incremental,
  { name: "Alpha", cardIds: [1, 2] },
  { name: "Alpha", cardIds: [2, 3] },
);
check(incremental.get(1)?.join(",") === "Beta", "removing a card from one board keeps the other");
check(incremental.get(2)?.join(",") === "Alpha", "kept card stays marked");
check(incremental.get(3)?.join(",") === "Alpha", "newly added card is marked");
applyBoardCardIndex(incremental, { name: "Beta", cardIds: [1] }, null);
check(incremental.has(1) === false, "last board drop clears the mark");

console.log("blockMarks.test.ts ok");
