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
  addLinkRefId,
  EDGE_LINK_PROP,
  findExistingEdgeLink,
  isPluginPropertyRef,
  parseLinkRefIds,
  REF_TYPE_PROPERTY,
  removeLinkRefId,
} = await import("./edgeLink.ts");
const { planEdgeLinkSync } = await import("./edgeLinkSync.ts");

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

check(EDGE_LINK_PROP === "whiteboard.link", "property name is stable");
check(REF_TYPE_PROPERTY === 2, "property refs use type 2");

check(parseLinkRefIds([10, 20, 10]).join(",") === "10,20", "parse drops duplicate ids");
check(parseLinkRefIds(["10", 11, null, 12]).join(",") === "11,12", "parse keeps finite numbers");
check(parseLinkRefIds("[3,4]").join(",") === "3,4", "parse accepts a JSON array string");
check(parseLinkRefIds("nope").length === 0, "junk string is empty");
check(parseLinkRefIds(undefined).length === 0, "missing value is empty");
check(parseLinkRefIds({}).length === 0, "non-array is empty");

const added = addLinkRefId([1, 2], 3);
check(added.join(",") === "1,2,3", "add appends a new id");
check(addLinkRefId(added, 2).join(",") === "1,2,3", "add is idempotent");
check(removeLinkRefId(added, 2).join(",") === "1,3", "remove drops one id");
check(removeLinkRefId(added, 9).join(",") === "1,2,3", "remove of a missing id is a no-op");

const refs = [
  { id: 100, to: 2, type: REF_TYPE_PROPERTY },
  { id: 101, to: 3, type: REF_TYPE_PROPERTY },
  { id: 102, to: 2, type: 1 },
  { id: 103, to: 4, type: REF_TYPE_PROPERTY },
];
const propIds = [100, 101];

check(
  findExistingEdgeLink(refs, propIds, 2) === 100,
  "finds a plugin property ref to the target",
);
check(
  findExistingEdgeLink(refs, propIds, 3) === 101,
  "finds another plugin property ref on the same source",
);
check(
  findExistingEdgeLink(refs, propIds, 4) === undefined,
  "ignores a property ref that is not in the plugin array",
);
check(
  findExistingEdgeLink(refs, propIds, 9) === undefined,
  "missing target is not a hit",
);
check(
  findExistingEdgeLink(refs, [], 2) === undefined,
  "empty property array means no plugin ref",
);

check(isPluginPropertyRef(refs[0], propIds) === true, "owned property ref");
check(isPluginPropertyRef(refs[2], propIds) === false, "inline ref is not a plugin property");
check(isPluginPropertyRef(refs[3], propIds) === false, "foreign property ref is ignored");

function line(
  id: string,
  from: number,
  to: number,
  extra: Record<string, unknown> = {},
) {
  return { id, from, to, arrow: "end", ...extra };
}

const hung = [line("e1", 1, 2, { linkRefId: 99 })];
const retargeted = [line("e1", 1, 3, { linkRefId: 99 })];

const rebindOn = planEdgeLinkSync(hung, retargeted, {
  rebindEndpoints: true,
  autoLink: true,
});
check(rebindOn.unlinks.length === 1, "rehang with flag on unlinks the old pair");
check(
  rebindOn.unlinks[0].from === 1 && rebindOn.unlinks[0].to === 2,
  "unlink uses the old endpoints",
);
check(rebindOn.links.length === 1, "rehang with flag on links the new pair");
check(
  rebindOn.links[0].edge.from === 1 && rebindOn.links[0].edge.to === 3,
  "link uses the new endpoints",
);
check(rebindOn.links[0].restore === false, "rehang is not a restore");

const rebindOff = planEdgeLinkSync(hung, retargeted, {
  rebindEndpoints: false,
  autoLink: true,
});
check(
  rebindOff.unlinks.length === 0 && rebindOff.links.length === 0,
  "rehang with flag off does nothing",
);

const fromMoved = planEdgeLinkSync(
  [line("e1", 1, 2, { linkRefId: 5 })],
  [line("e1", 4, 2, { linkRefId: 5 })],
  { rebindEndpoints: true, autoLink: true },
);
check(fromMoved.unlinks[0]?.from === 1, "source rehang unlinks the old source");
check(fromMoved.links[0]?.edge.from === 4, "source rehang links the new source");

const decorative = planEdgeLinkSync(
  [line("e1", 1, 2)],
  [line("e1", 1, 3)],
  { rebindEndpoints: true, autoLink: true },
);
check(
  decorative.unlinks.length === 0 && decorative.links.length === 0,
  "rehang of a decorative line does not invent a ref",
);

const noAuto = planEdgeLinkSync(hung, retargeted, {
  rebindEndpoints: true,
  autoLink: false,
});
check(noAuto.unlinks.length === 1, "rehang still unlinks when auto-link is off");
check(noAuto.links.length === 0, "rehang does not relink when auto-link is off");

const dropped = planEdgeLinkSync(hung, [], {
  rebindEndpoints: false,
  autoLink: true,
});
check(dropped.unlinks.length === 1 && dropped.links.length === 0, "delete still unlinks");

const restored = planEdgeLinkSync([], hung, {
  rebindEndpoints: false,
  autoLink: false,
});
check(restored.links.length === 1 && restored.links[0].restore === true, "deleted line is restored");
check(restored.unlinks.length === 0, "restore does not unlink");

console.log("edgeLink.test.ts ok");
