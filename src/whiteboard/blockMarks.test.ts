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
  outlineMarkLabel,
  OWB_MARK_ATTR,
  OWB_MARK_LABEL_ATTR,
} = await import("./blockMarks.ts");
const { currentBoardIdFromPanel } = await import("./blockMarkLabel.ts");

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
check(!css10.includes("color-mix("), "outline rows have no full-row tint");
check(!css10.includes("inset 2.5px 0 0 0"), "outline rows have no left bar");
check(
  !css10.includes(".owb-card .orca-block[data-owb-mark]"),
  "no card-scoped cancel rule after the outline tint was removed",
);
check(
  css10.includes(`[${OWB_MARK_LABEL_ATTR}]`),
  "tooltip only when a cross-board label is stamped",
);

const collected = collectCardBoards([
  {
    id: 100,
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
    id: 101,
    aliases: ["Beta"],
    properties: [{ name: "cards", value: cardJson(1) }],
  },
  {
    id: 102,
    aliases: ["Empty"],
    properties: [{ name: "cards", value: "[]" }],
  },
  {
    aliases: ["NoId"],
    properties: [{ name: "cards", value: cardJson(9) }],
  },
]);

function namesOf(refs: { name: string }[] | undefined): string {
  return (refs ?? []).map((ref) => ref.name).join(",");
}

check(collected.size === 2, "only blocks that appear on a board");
check(namesOf(collected.get(1)) === "Alpha,Beta", "multi-board names keep order");
check(namesOf(collected.get(2)) === "Alpha", "single-board name");
check(collected.has(9) === false, "boards without an id are skipped");
check(
  markLabelFor(collected.get(1)?.map((ref) => ref.name)) === "On 2 whiteboards",
  "multi-board tooltip",
);
check(
  markLabelFor(collected.get(2)?.map((ref) => ref.name)) ===
    'On the "Alpha" whiteboard',
  "single-board tooltip",
);
check(markLabelFor(undefined) === null, "missing names are unmarked");
check(markLabelFor([]) === null, "empty names are unmarked");

const incremental = new Map();
applyBoardCardIndex(incremental, null, {
  boardId: 100,
  name: "Alpha",
  cardIds: [1, 2],
});
applyBoardCardIndex(incremental, null, {
  boardId: 101,
  name: "Beta",
  cardIds: [1],
});
check(
  namesOf(incremental.get(1)) === "Alpha,Beta",
  "incremental add keeps cross-board names",
);
applyBoardCardIndex(
  incremental,
  { boardId: 100, name: "Alpha", cardIds: [1, 2] },
  { boardId: 100, name: "Alpha", cardIds: [2, 3] },
);
check(namesOf(incremental.get(1)) === "Beta", "removing a card from one board keeps the other");
check(namesOf(incremental.get(2)) === "Alpha", "kept card stays marked");
check(namesOf(incremental.get(3)) === "Alpha", "newly added card is marked");
applyBoardCardIndex(incremental, { boardId: 101, name: "Beta", cardIds: [1] }, null);
check(incremental.has(1) === false, "last board drop clears the mark");

const onAlphaAndBeta = collected.get(1);
check(
  outlineMarkLabel(onAlphaAndBeta, null) === "On 2 whiteboards",
  "unknown current board keeps the full label",
);
check(
  outlineMarkLabel(onAlphaAndBeta, 100) === 'On the "Beta" whiteboard',
  "hides the board the user is already on",
);
check(
  outlineMarkLabel(onAlphaAndBeta, 101) === 'On the "Alpha" whiteboard',
  "label names the other board",
);
check(
  outlineMarkLabel(collected.get(2), 100) === null,
  "no label when the card is only on the current board",
);
check(
  outlineMarkLabel(collected.get(2), 999) === 'On the "Alpha" whiteboard',
  "label stays when the current board is a different one",
);
check(outlineMarkLabel(undefined, 100) === null, "missing boards stay unmarked");
check(outlineMarkLabel([], 100) === null, "empty boards stay unmarked");

const threeBoards = [
  { id: 1, name: "A" },
  { id: 2, name: "B" },
  { id: 3, name: "C" },
];
check(
  outlineMarkLabel(threeBoards, 1) === "On 2 whiteboards",
  "remaining others still use the multi-board wording",
);

check(
  currentBoardIdFromPanel(
    { view: "whiteboard.board", viewArgs: { blockId: 42 } },
    { panelType: "whiteboard.board" },
  ) === 42,
  "canvas panel is the current board",
);
check(
  currentBoardIdFromPanel(
    { view: "block", viewArgs: { blockId: 7 } },
    { panelType: "whiteboard.board", isWhiteboardView: true },
  ) === 7,
  "page-board outline counts when confirmed",
);
check(
  currentBoardIdFromPanel(
    { view: "block", viewArgs: { blockId: 7 } },
    { panelType: "whiteboard.board" },
  ) === null,
  "plain block view is not assumed to be a board",
);
check(
  currentBoardIdFromPanel(null, { panelType: "whiteboard.board" }) === null,
  "missing panel degrades to unknown",
);
check(
  currentBoardIdFromPanel(
    { view: "whiteboard.board", viewArgs: {} },
    { panelType: "whiteboard.board" },
  ) === null,
  "canvas panel without a block id is unknown",
);
check(
  currentBoardIdFromPanel(
    { view: "journal", viewArgs: { blockId: 42 } },
    { panelType: "whiteboard.board" },
  ) === null,
  "journal view is not a board",
);

console.log("blockMarks.test.ts ok");
