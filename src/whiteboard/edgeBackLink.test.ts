// @ts-nocheck — Node assertion script; tsc has no @types/node in this package.
import { register } from "node:module";

const g = globalThis as typeof globalThis & {
  window: {
    React: Record<string, unknown>;
    Valtio: { subscribe: () => () => void };
  };
  orca: {
    state: { blocks: Record<number, unknown>; plugins: Record<string, unknown> };
    invokeBackend: (cmd: string, ...args: unknown[]) => Promise<unknown>;
    broadcasts: { broadcast: () => void };
    notify: () => void;
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

const backendBlocks: Record<number, unknown> = {};
let createRefCalls = 0;
let setPropsCalls = 0;

g.orca = {
  state: {
    blocks: {},
    plugins: {
      "whiteboard": {
        settings: { bidirectionalEdgeLinks: true },
      },
    },
  },
  invokeBackend: async (cmd: string, ...args: unknown[]) => {
    if (cmd === "get-block") {
      const id = args[0] as number;
      return backendBlocks[id] ?? null;
    }
    if (cmd === "create-ref") {
      createRefCalls += 1;
      const [fromId, toId, type, alias] = args;
      const refId = 500 + createRefCalls;
      const block = backendBlocks[fromId as number] as { refs?: Array<unknown> } | undefined;
      if (block != null) {
        block.refs = [...(block.refs ?? []), { id: refId, from: fromId, to: toId, type, alias }];
      }
      return [refId];
    }
    if (cmd === "set-properties") {
      setPropsCalls += 1;
      const [ids, props] = args as [number[], Array<{ name: string; value: unknown }>];
      for (const id of ids) {
        const block = backendBlocks[id] as { properties?: Array<{ name: string; value: unknown }> } | undefined;
        if (block != null) {
          const list = [...(block.properties ?? [])];
          for (const prop of props) {
            const idx = list.findIndex((item) => item.name === prop.name);
            if (idx >= 0) list[idx] = prop;
            else list.push(prop);
          }
          block.properties = list;
        }
      }
      return null;
    }
    return null;
  },
  broadcasts: { broadcast: () => {} },
  notify: () => {},
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
  linkEdgeBackByProperty,
  unlinkEdgeBackByProperty,
} = await import("./edgeBackLink.ts");
const {
  EDGE_LINK_BACK_PROP,
  EDGE_LINK_PROP,
  readEdgeLinkBackPropIds,
  findExistingEdgeLink,
  linkEdgeByProperty,
  readEdgeLinkPropIds,
  REF_TYPE_PROPERTY,
  unlinkEdgeByProperty,
} = await import("./edgeLink.ts");
const { collectCardRelations } = await import("./cardRelations.ts");
const { collectReferenceEdges, REF_TYPE_INLINE } = await import("./edgeRefs.ts");

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

// 1. Property names and helpers
check(EDGE_LINK_BACK_PROP === "whiteboard.linkBack", "back-link property name is whiteboard.linkBack");
check(EDGE_LINK_PROP === "whiteboard.link", "forward link property name is whiteboard.link");

const testBlock = {
  properties: [
    { name: EDGE_LINK_PROP, value: [10, 20] },
    { name: EDGE_LINK_BACK_PROP, value: [30, 40] },
  ],
};
check(readEdgeLinkPropIds(testBlock).join(",") === "10,20", "read forward link prop ids");
check(readEdgeLinkBackPropIds(testBlock).join(",") === "30,40", "read back link prop ids");
check(readEdgeLinkBackPropIds(undefined).length === 0, "read missing block is empty array");
check(readEdgeLinkBackPropIds({}).length === 0, "read block with no properties is empty array");

// 2. Idempotent linkEdgeBackByProperty and linkEdgeByProperty
backendBlocks[1] = { id: 1, properties: [], refs: [], backRefs: [] };
backendBlocks[2] = { id: 2, properties: [], refs: [], backRefs: [] };

const edge1to2 = { id: "e1", from: 1, to: 2, arrow: "end" as const, label: "leads to" };

createRefCalls = 0;
setPropsCalls = 0;

const forwardRefId = await linkEdgeByProperty(edge1to2);
check(typeof forwardRefId === "number", "forward link returned a refId");
check(createRefCalls === 2, "created 2 refs (forward + backward)");

const b1 = backendBlocks[1] as { properties: Array<{ name: string; value: unknown }> };
const b2 = backendBlocks[2] as { properties: Array<{ name: string; value: unknown }> };

const fwdIds = readEdgeLinkPropIds(b1);
const backIds = readEdgeLinkBackPropIds(b2);
check(fwdIds.includes(forwardRefId), "source block 1 has forward link in whiteboard.link");
check(backIds.length === 1, "target block 2 has 1 ref in whiteboard.linkBack");
check(readEdgeLinkPropIds(b2).length === 0, "target block 2 has no forward link in whiteboard.link");
check(readEdgeLinkBackPropIds(b1).length === 0, "source block 1 has no back link in whiteboard.linkBack");

// Repeating linkEdgeByProperty must be idempotent (no extra refs created)
const prevCreateCalls = createRefCalls;
const secondRefId = await linkEdgeByProperty(edge1to2);
check(secondRefId === forwardRefId, "idempotent call returns same forward refId");
check(createRefCalls === prevCreateCalls, "idempotent call created 0 new refs");

// 3. Section 3.3 Filtering verification
function card(blockId: number) {
  return { blockId, kind: "block" as const, x: 0, y: 0, w: 100, h: 80 };
}

const sourceBlockModel = {
  children: [],
  refs: [{ id: forwardRefId, type: REF_TYPE_PROPERTY, from: 1, to: 2 }],
  backRefs: [{ id: backIds[0], type: REF_TYPE_PROPERTY, from: 2, to: 1 }],
  properties: [{ name: EDGE_LINK_PROP, type: 2, value: [forwardRefId] }],
};

const targetBlockModel = {
  children: [],
  refs: [{ id: backIds[0], type: REF_TYPE_PROPERTY, from: 2, to: 1 }],
  backRefs: [{ id: forwardRefId, type: REF_TYPE_PROPERTY, from: 1, to: 2 }],
  properties: [{ name: EDGE_LINK_BACK_PROP, type: 2, value: [backIds[0]] }],
};

const blockGraph = {
  1: sourceBlockModel,
  2: targetBlockModel,
};

// 3a. collectReferenceEdges: MUST NOT produce a reverse edge (2 -> 1)
const refResult = collectReferenceEdges([card(1), card(2)], blockGraph, new Set());
check(refResult.edges.length === 1, "only 1 reference edge produced");
check(refResult.edges[0].from === 1 && refResult.edges[0].to === 2, "produced edge is forward 1 -> 2");
check(!refResult.edges.some((e) => e.from === 2 && e.to === 1), "no reverse 2 -> 1 reference edge");

// 3b. collectCardRelations:
// For Card 1: target Card 2 should have dir = "out" (NOT "both")
const relations1 = collectCardRelations(1, [card(1), card(2)], blockGraph);
check(relations1.shown.length === 1, "card 1 has 1 relation");
check(relations1.shown[0].blockId === 2, "relation is with card 2");
check(relations1.shown[0].dir === "out", "card 1 relation direction is strictly 'out' (not 'both')");

// For Card 2: source Card 1 should have dir = "in" (NOT "both")
const relations2 = collectCardRelations(2, [card(1), card(2)], blockGraph);
check(relations2.shown.length === 1, "card 2 has 1 relation");
check(relations2.shown[0].blockId === 1, "relation is with card 1");
check(relations2.shown[0].dir === "in", "card 2 relation direction is strictly 'in' (not 'both')");

// 4. Unlink deletes both forward and backward references
const edgeToUnlink = { ...edge1to2, linkRefId: forwardRefId };
await unlinkEdgeByProperty(edgeToUnlink);

const b1After = backendBlocks[1] as { properties: Array<{ name: string; value: unknown }> };
const b2After = backendBlocks[2] as { properties: Array<{ name: string; value: unknown }> };
check(readEdgeLinkPropIds(b1After).length === 0, "forward link removed from source whiteboard.link");
check(readEdgeLinkBackPropIds(b2After).length === 0, "back link removed from target whiteboard.linkBack");

// 5. Unlink deleted target block no-ops without error
backendBlocks[99] = { id: 99, properties: [], refs: [], backRefs: [] };
const edgeWithMissingTarget = { id: "e-missing", from: 99, to: 404, arrow: "end" as const, linkRefId: 123 };
await unlinkEdgeByProperty(edgeWithMissingTarget);

console.log("edgeBackLink.test.ts ok");
