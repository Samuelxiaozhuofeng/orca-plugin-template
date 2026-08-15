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
  cardBlockWatchIds,
} = await import("./blockWatch.ts");
const {
  CARD_TREE_LOAD_MAX_DEPTH,
  CARD_TREE_LOAD_MAX_NODES,
} = await import("./cardTreeLoad.ts");

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const deep: Record<number, { children: number[]; text: string }> = {};
for (let i = 1; i <= 4000; i++) {
  deep[i] = { children: i < 4000 ? [i + 1] : [], text: "" };
}

const ids = cardBlockWatchIds(1, deep);
check(
  ids.length === CARD_TREE_LOAD_MAX_DEPTH + 1,
  "useCardBlockView watches at the load depth cap, not the whole outline",
);
check(
  ids.length <= CARD_TREE_LOAD_MAX_NODES,
  "useCardBlockView watches at most the load node cap",
);
check(ids[0] === 1 && ids[ids.length - 1] === CARD_TREE_LOAD_MAX_DEPTH + 1, "watch starts at the card root");

console.log("blockWatch.test.ts ok");
