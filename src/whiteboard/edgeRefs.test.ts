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
  collectReferenceEdges,
  referenceRelationKey,
  REF_TYPE_INLINE,
  REF_WALK_MAX_BLOCKS,
} = await import("./edgeRefs.ts");
const { EDGE_LINK_PROP, REF_TYPE_PROPERTY } = await import("./edgeLink.ts");

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function card(blockId: number) {
  return { blockId, kind: "block", x: 0, y: 0, w: 100, h: 80 };
}

function inlineRef(to: number) {
  return { type: REF_TYPE_INLINE, to };
}

function edgeKey(edge: { from: number; to: number }): string {
  return `${edge.from}->${edge.to}`;
}

const cardA = card(1);
const cardB = card(2);
const cardC = card(3);

const linkedBlocks = {
  1: { children: [], refs: [inlineRef(2)] },
  2: { children: [], refs: [] },
  3: { children: [], refs: [inlineRef(1)] },
};

const noneDrawn = new Set();

const allThree = collectReferenceEdges(
  [cardA, cardB, cardC],
  linkedBlocks,
  noneDrawn,
);
check(allThree.truncated === false, "small set is not truncated");
check(allThree.edges.length === 2, "both in-set references become edges");
check(
  allThree.edges.map(edgeKey).sort().join(",") === "1->2,3->1",
  "edges join the cards that own each ref",
);

const onlyA = collectReferenceEdges([cardA], linkedBlocks, noneDrawn);
check(onlyA.edges.length === 0, "target card outside the input set is dropped");
check(onlyA.truncated === false, "partial input is not a walk truncation");

const aAndB = collectReferenceEdges([cardA, cardB], linkedBlocks, noneDrawn);
check(aAndB.edges.length === 1, "only the in-set pair is kept");
check(edgeKey(aAndB.edges[0]) === "1->2", "kept edge is A→B");

const aAndC = collectReferenceEdges([cardA, cardC], linkedBlocks, noneDrawn);
check(aAndC.edges.length === 1, "C→A stays when both cards are passed");
check(edgeKey(aAndC.edges[0]) === "3->1", "kept edge is C→A");
check(
  aAndC.edges.every((edge) => edge.from !== 1 || edge.to !== 2),
  "A→B is omitted when B is not in the input set",
);

const underMaxChildren: number[] = [];
for (let id = 2; id <= REF_WALK_MAX_BLOCKS; id++) underMaxChildren.push(id);
const underMaxBlocks: Record<number, { children: number[]; refs: unknown[] }> =
  { 1: { children: underMaxChildren, refs: [] } };
for (const id of underMaxChildren) {
  underMaxBlocks[id] = { children: [], refs: [] };
}
const underMax = collectReferenceEdges([card(1)], underMaxBlocks, noneDrawn);
check(
  underMax.truncated === false,
  "exactly the walk budget is not truncated",
);

const overMaxChildren: number[] = [];
for (let id = 2; id <= REF_WALK_MAX_BLOCKS + 1; id++) overMaxChildren.push(id);
const overMaxBlocks: Record<number, { children: number[]; refs: unknown[] }> = {
  1: { children: overMaxChildren, refs: [] },
};
for (const id of overMaxChildren) {
  overMaxBlocks[id] = { children: [], refs: [] };
}
const overMax = collectReferenceEdges([card(1)], overMaxBlocks, noneDrawn);
check(overMax.truncated === true, "one block past the walk budget is truncated");

const cache = new Map();
const forest = [card(1), card(2), card(3)];
const stats1 = { walked: 0 };
const key1 = referenceRelationKey(forest, linkedBlocks, cache, stats1);
check(stats1.walked === 3, "cold fingerprint walks each card once");
const stats2 = { walked: 0 };
const key2 = referenceRelationKey(forest, linkedBlocks, cache, stats2);
check(key2 === key1, "cached fingerprint is stable");
check(stats2.walked === 0, "unchanged cards are not walked again");

const textOnly = {
  1: { children: [], refs: [inlineRef(2)], text: "edited" },
  2: { children: [], refs: [] },
  3: { children: [], refs: [inlineRef(1)] },
};
const stats3 = { walked: 0 };
const key3 = referenceRelationKey(forest, textOnly, cache, stats3);
check(key3 === key1, "text edits do not change the relation fingerprint");
check(stats3.walked === 0, "text edits do not re-walk the forest");

const childChanged = {
  1: { children: [4], refs: [inlineRef(2)] },
  2: { children: [], refs: [] },
  3: { children: [], refs: [inlineRef(1)] },
  4: { children: [], refs: [] },
};
const stats4 = { walked: 0 };
const key4 = referenceRelationKey(forest, childChanged, cache, stats4);
check(key4 !== key1, "child-list changes invalidate the fingerprint");
check(stats4.walked === 1, "only the dirty card is walked");

function propertyRef(id: number, to: number) {
  return { type: REF_TYPE_PROPERTY, id, to };
}

const pluginLinked = {
  1: {
    children: [],
    refs: [propertyRef(100, 2)],
    properties: [{ name: EDGE_LINK_PROP, type: 2, value: [100] }],
  },
  2: { children: [], refs: [] },
  3: { children: [], refs: [] },
};
const fromPlugin = collectReferenceEdges([cardA, cardB], pluginLinked, noneDrawn);
check(fromPlugin.edges.length === 1, "plugin property refs become dashed edges");
check(edgeKey(fromPlugin.edges[0]) === "1->2", "plugin property edge is A→B");

const foreignProp = {
  1: {
    children: [],
    refs: [propertyRef(200, 2)],
    properties: [{ name: "other.rel", type: 2, value: [200] }],
  },
  2: { children: [], refs: [] },
};
const fromForeign = collectReferenceEdges([cardA, cardB], foreignProp, noneDrawn);
check(fromForeign.edges.length === 0, "foreign property refs are not drawn");

const orphanProp = {
  1: {
    children: [],
    refs: [propertyRef(100, 2)],
    properties: [{ name: EDGE_LINK_PROP, type: 2, value: [] }],
  },
  2: { children: [], refs: [] },
};
const fromOrphan = collectReferenceEdges([cardA, cardB], orphanProp, noneDrawn);
check(fromOrphan.edges.length === 0, "property refs outside the plugin array are ignored");

const alreadyDrawn = collectReferenceEdges(
  [cardA, cardB],
  pluginLinked,
  new Set(["1:2"]),
);
check(alreadyDrawn.edges.length === 0, "drawn pair suppresses the implicit property edge");

const bothKinds = {
  1: {
    children: [],
    refs: [inlineRef(2), propertyRef(100, 3)],
    properties: [{ name: EDGE_LINK_PROP, type: 2, value: [100] }],
  },
  2: { children: [], refs: [] },
  3: { children: [], refs: [] },
};
const mixed = collectReferenceEdges([cardA, cardB, cardC], bothKinds, noneDrawn);
check(mixed.edges.length === 2, "inline and plugin property refs can coexist");

const propCache = new Map();
const propForest = [card(1), card(2)];
const propStats1 = { walked: 0 };
const propKey1 = referenceRelationKey(propForest, pluginLinked, propCache, propStats1);
check(propStats1.walked === 2, "property-ref forest walks each card");
const propStats2 = { walked: 0 };
const propKey2 = referenceRelationKey(propForest, pluginLinked, propCache, propStats2);
check(propKey2 === propKey1, "unchanged property refs reuse the fingerprint");
check(propStats2.walked === 0, "unchanged property refs are not walked again");

const propArrayChanged = {
  1: {
    children: [],
    refs: [propertyRef(100, 2)],
    properties: [{ name: EDGE_LINK_PROP, type: 2, value: [] }],
  },
  2: { children: [], refs: [] },
};
const propStats3 = { walked: 0 };
const propKey3 = referenceRelationKey(
  propForest,
  propArrayChanged,
  propCache,
  propStats3,
);
check(propKey3 !== propKey1, "plugin property array changes invalidate the fingerprint");
check(propStats3.walked === 1, "only the dirty property-ref card is walked");

console.log("edgeRefs.test.ts ok");
