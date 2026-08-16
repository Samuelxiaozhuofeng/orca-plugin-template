// @ts-nocheck — Node assertion script; tsc has no @types/node in this package.
import { register } from "node:module";

const g = globalThis as typeof globalThis & {
  window: { React: { useEffect: () => void } };
  Element: typeof FakeEl;
  HTMLElement: typeof FakeEl;
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

class FakeEl {
  parent: FakeEl | null = null;
  className: string;
  attrs: Record<string, string>;

  constructor(init: { className?: string; attrs?: Record<string, string> } = {}) {
    this.className = init.className ?? "";
    this.attrs = { ...(init.attrs ?? {}) };
  }

  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }

  closest(sel: string): FakeEl | null {
    let cur: FakeEl | null = this;
    while (cur != null) {
      if (fakeMatches(cur, sel)) return cur;
      cur = cur.parent;
    }
    return null;
  }
}

function fakeMatches(el: FakeEl, sel: string): boolean {
  return sel.split(",").some((part) => fakeMatchesOne(el, part.trim()));
}

function fakeMatchesOne(el: FakeEl, sel: string): boolean {
  const tokenRe =
    /(\.[A-Za-z0-9_-]+)|\[([A-Za-z0-9_-]+)(?:=['"]?([^\]'"]*)['"]?)?\]/g;
  let matched = false;
  let token: RegExpExecArray | null;
  while ((token = tokenRe.exec(sel)) != null) {
    matched = true;
    if (token[1] != null) {
      const cls = token[1].slice(1);
      if (!el.className.split(/\s+/).includes(cls)) return false;
    } else if (token[2] != null) {
      const value = el.attrs[token[2]];
      if (token[3] != null) {
        if (value !== token[3]) return false;
      } else if (value == null) {
        return false;
      }
    }
  }
  return matched;
}

g.window = {
  ...(g.window ?? {}),
  React: { useEffect: () => {} },
};
g.Element = FakeEl;
g.HTMLElement = FakeEl;

const { tryFocusCardFromRefClick } = await import("./cardFocus.ts");

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function inlineRefEl(blockId: number): FakeEl {
  return new FakeEl({
    className: "orca-inline",
    attrs: { "data-type": "r", "data-ref": String(blockId) },
  });
}

function makeEvent(target: FakeEl) {
  const counts = { prevent: 0, stop: 0, stopImm: 0 };
  return {
    event: {
      target,
      altKey: false,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      button: 0,
      preventDefault: () => {
        counts.prevent += 1;
      },
      stopPropagation: () => {
        counts.stop += 1;
      },
      nativeEvent: {
        stopImmediatePropagation: () => {
          counts.stopImm += 1;
        },
      },
    },
    counts,
  };
}

const CARD_ID = 42;
const cards = [{ blockId: CARD_ID }];

{
  const { event, counts } = makeEvent(inlineRefEl(CARD_ID));
  let focused = 0;
  const handled = tryFocusCardFromRefClick(
    event,
    cards,
    () => {
      focused += 1;
      return true;
    },
    () => true,
  );
  check(handled === false, "skip callback true does not focus the card");
  check(focused === 0, "skip callback true does not call focusCard");
  check(counts.prevent === 0, "skip true does not preventDefault");
  check(counts.stop === 0, "skip true does not stopPropagation");
  check(counts.stopImm === 0, "skip true does not stopImmediatePropagation");
}

{
  const { event, counts } = makeEvent(inlineRefEl(CARD_ID));
  let focused = 0;
  const handled = tryFocusCardFromRefClick(
    event,
    cards,
    (id: number) => {
      focused += 1;
      return id === CARD_ID;
    },
    () => false,
  );
  check(handled === true, "skip callback false still focuses a board card");
  check(focused === 1, "skip callback false still calls focusCard");
  check(counts.prevent === 1, "skip false still preventDefault");
  check(counts.stop === 1, "skip false still stopPropagation");
  check(counts.stopImm === 1, "skip false still stopImmediatePropagation");
}

{
  const { event, counts } = makeEvent(inlineRefEl(CARD_ID));
  let focused = 0;
  const handled = tryFocusCardFromRefClick(event, cards, () => {
    focused += 1;
    return true;
  });
  check(handled === true, "omitted skip callback keeps original focus");
  check(focused === 1, "omitted skip callback still calls focusCard");
  check(counts.prevent === 1, "omitted skip still preventDefault");
  check(counts.stop === 1, "omitted skip still stopPropagation");
  check(counts.stopImm === 1, "omitted skip still stopImmediatePropagation");
}

console.log("cardFocus tests passed");
