// @ts-nocheck — Node assertion script; tsc has no @types/node in this package.
import { register } from "node:module";

const g = globalThis as typeof globalThis & {
  window: {
    React: Record<string, unknown>;
    Valtio: { subscribe: () => () => void };
  };
};
g.window = {
  ...(g.window ?? {}),
  React: {
    useMemo: (fn: () => unknown) => fn(),
    useEffect: () => {},
    useRef: (value: unknown) => ({ current: value ?? null }),
    useState: (value: unknown) => [value, () => {}],
  },
  Valtio: {
    subscribe: () => () => {},
  },
};

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
  clipRelationSnippet,
  collectCardRelations,
  relationKind,
  relationKindIcon,
  relationSnippet,
  relationTitle,
  RELATION_MAP_LIMIT,
  RELATION_SNIPPET_MAX,
} = await import("./cardRelations.ts");
const { REF_TYPE_INLINE } = await import("./edgeRefs.ts");
const { EDGE_LINK_BACK_PROP, EDGE_LINK_PROP, REF_TYPE_PROPERTY } = await import("./edgeLink.ts");

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function card(blockId: number) {
  return { blockId, kind: "block", x: 0, y: 0, w: 100, h: 80 };
}

function inline(to: number) {
  return { id: to + 1000, type: REF_TYPE_INLINE, from: 1, to };
}

function propRef(id: number, from: number, to: number) {
  return { id, type: REF_TYPE_PROPERTY, from, to };
}

const cards = [card(1), card(2)];

const outgoingOff = collectCardRelations(
  1,
  cards,
  {
    1: { children: [], refs: [inline(9)], backRefs: [] },
    2: { children: [], refs: [], backRefs: [] },
  },
);
check(outgoingOff.total === 1, "one outgoing off-board ref");
check(outgoingOff.offBoard === 1 && outgoingOff.onBoard === 0, "target 9 is off-board");
check(outgoingOff.shown[0]?.blockId === 9, "shown node is 9");
check(outgoingOff.shown[0]?.onBoard === false, "9 is marked off-board");
check(outgoingOff.offBoardIds.join(",") === "9", "off-board ids lists 9");

const onBoard = collectCardRelations(
  1,
  cards,
  {
    1: {
      children: [],
      refs: [inline(2)],
      backRefs: [],
    },
    2: { children: [], refs: [], backRefs: [] },
  },
);
check(onBoard.onBoard === 1 && onBoard.offBoard === 0, "target 2 is on-board");
check(onBoard.shown[0]?.ownerCardId === 2, "owner is card 2");

const pluginOn = collectCardRelations(
  1,
  cards,
  {
    1: {
      children: [],
      refs: [propRef(50, 1, 2)],
      backRefs: [],
      properties: [{ name: EDGE_LINK_PROP, type: 2, value: [50] }],
    },
    2: { children: [], refs: [], backRefs: [] },
  },
);
check(pluginOn.total === 1, "plugin property ref is counted");
check(pluginOn.shown[0]?.onBoard === true, "plugin target on the board is on-board");

const backLinkTarget = collectCardRelations(
  1,
  cards,
  {
    1: {
      children: [],
      refs: [propRef(50, 1, 2)],
      backRefs: [{ id: 60, type: REF_TYPE_PROPERTY, from: 2, to: 1 }],
      properties: [{ name: EDGE_LINK_PROP, type: 2, value: [50] }],
    },
    2: {
      children: [],
      refs: [{ id: 60, type: REF_TYPE_PROPERTY, from: 2, to: 1 }],
      backRefs: [propRef(50, 1, 2)],
      properties: [{ name: EDGE_LINK_BACK_PROP, type: 2, value: [60] }],
    },
  },
);
check(backLinkTarget.total === 1, "card 1 sees 1 relation");
check(backLinkTarget.shown[0]?.dir === "out", "card 1 sees card 2 as strictly 'out', not 'both'");

const foreign = collectCardRelations(
  1,
  cards,
  {
    1: {
      children: [],
      refs: [propRef(77, 1, 2)],
      backRefs: [],
      properties: [{ name: "other.rel", type: 2, value: [77] }],
    },
    2: { children: [], refs: [], backRefs: [] },
  },
);
check(foreign.total === 0, "foreign property refs are ignored");

const incomingOk = collectCardRelations(
  1,
  cards,
  {
    1: {
      children: [],
      refs: [],
      backRefs: [{ id: 3, type: REF_TYPE_INLINE, from: 8, to: 1 }],
    },
    2: { children: [], refs: [], backRefs: [] },
  },
);
check(incomingOk.total === 1 && incomingOk.offBoardIds[0] === 8, "incoming from 8 is off-board");

const selfSkip = collectCardRelations(
  1,
  cards,
  {
    1: {
      children: [11],
      refs: [inline(11)],
      backRefs: [],
    },
    11: { children: [], refs: [], backRefs: [] },
    2: { children: [], refs: [], backRefs: [] },
  },
);
check(selfSkip.total === 0, "refs inside the same card tree are skipped");

const dup = collectCardRelations(
  1,
  cards,
  {
    1: {
      children: [11],
      refs: [inline(9)],
      backRefs: [],
    },
    11: {
      children: [],
      refs: [inline(9)],
      backRefs: [],
    },
    2: { children: [], refs: [], backRefs: [] },
  },
);
check(dup.total === 1, "same target via two paths is one node");

const both = collectCardRelations(
  1,
  [card(1)],
  {
    1: {
      children: [],
      refs: [inline(4)],
      backRefs: [{ id: 5, type: REF_TYPE_INLINE, from: 4, to: 1 }],
    },
  },
);
check(both.total === 1 && both.shown[0]?.dir === "both", "in+out to the same id is one node");
check(both.incoming.length === 1 && both.outgoing.length === 1, "both appears in each section once");
check(
  both.incoming[0]?.blockId === 4 && both.outgoing[0]?.blockId === 4,
  "both sections point at the same object",
);
check(both.incomingTotal === 1 && both.outgoingTotal === 1, "section totals count both");
check(both.shown[0]?.outSnippetId === 1, "outgoing snippet is my mentioning line");
check(both.shown[0]?.inSnippetId === 4, "incoming snippet is their mentioning line");

const manyRefs = [];
const manyBlocks = {
  1: { children: [], refs: [], backRefs: [] },
};
for (let i = 0; i < RELATION_MAP_LIMIT + 5; i++) {
  const to = 100 + i;
  manyRefs.push(inline(to));
  manyBlocks[to] = { children: [], refs: [], backRefs: [] };
}
manyBlocks[1].refs = manyRefs;
const capped = collectCardRelations(1, [card(1)], manyBlocks);
check(capped.total === RELATION_MAP_LIMIT + 5, "total counts every unique target");
check(capped.shown.length === RELATION_MAP_LIMIT, "display is capped");
check(capped.hidden === 5, "hidden remainder is reported");
check(
  capped.shown.every((node) => !node.onBoard),
  "off-board nodes fill the cap first",
);

const mixedRank = collectCardRelations(
  1,
  [card(1), card(2)],
  {
    1: {
      children: [],
      refs: [inline(2), inline(30), inline(31)],
      backRefs: [],
    },
    2: { children: [], refs: [], backRefs: [] },
  },
);
check(mixedRank.shown[0]?.onBoard === false, "off-board is ranked before on-board");
check(
  mixedRank.shown.some((node) => node.blockId === 2),
  "on-board still appears after off-board",
);

check(relationKind(undefined) === "note", "missing block is a plain note");
check(relationKindIcon("note") === "ti ti-file-text", "note icon");
check(
  relationKind({
    properties: [{ name: "_repr", value: { date: "2024-03-01T00:00:00.000Z" } }],
  }) === "journal",
  "date repr is a journal",
);
check(relationKindIcon("journal") === "ti ti-calendar", "journal icon");
check(
  relationKind({
    properties: [{ name: "_repr", value: { type: "whiteboard.canvas" } }],
  }) === "whiteboard",
  "canvas repr is a whiteboard",
);
check(relationKindIcon("whiteboard") === "ti ti-layout-board", "whiteboard icon");
check(
  relationKind({ aliases: ["Topic"] }) === "tag",
  "alias makes it a tag",
);
check(relationKindIcon("tag") === "ti ti-tag", "tag icon");
check(
  relationKind({
    aliases: ["Topic"],
    properties: [{ name: "_repr", value: { type: "whiteboard.canvas" } }],
  }) === "whiteboard",
  "whiteboard wins over alias",
);

check(relationTitle(1, { 1: { aliases: ["Alpha"], text: "body" } }) === "Alpha", "alias is the title");
check(
  relationTitle(1, { 1: { text: "first line\nsecond" } }) === "first line",
  "plain text uses the first line",
);
check(relationTitle(1, {}) === "", "missing block has an empty title");

check(clipRelationSnippet("  hello   world  ") === "hello world", "snippet collapses space");
check(clipRelationSnippet(undefined) === "", "missing snippet is empty");
const long = "字".repeat(RELATION_SNIPPET_MAX + 8);
const clipped = clipRelationSnippet(long);
check(clipped.endsWith("…"), "long snippet is truncated");
check(clipped.length === RELATION_SNIPPET_MAX + 1, "truncated snippet keeps the limit plus ellipsis");

const snippetBlocks = {
  1: { text: "I mentioned them here" },
  4: { text: "They mentioned me over there" },
};
check(
  relationSnippet(both.shown[0], "out", snippetBlocks) === "I mentioned them here",
  "out snippet reads my line",
);
check(
  relationSnippet(both.shown[0], "in", snippetBlocks) === "They mentioned me over there",
  "in snippet reads their line",
);

console.log("cardRelations.test.ts ok");
