// @ts-nocheck — Node assertion script; tsc has no @types/node in this package.
import { register } from "node:module";
import {
  boardCardInfoEqual,
  readBoardCardInfo,
} from "./boardCardView.ts";
import { WHITEBOARD_PAGE_PROP } from "./pageBoardPlan.ts";

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

const { cardBlockViewEqual } = await import("./blockWatch.ts");

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function cardJson(count: number): string {
  const cards = [];
  for (let i = 0; i < count; i++) {
    cards.push({ blockId: i + 1, x: 0, y: i * 20, w: 240, h: 160, kind: "block" });
  }
  return JSON.stringify(cards);
}

function pageBoard(flag: unknown, cards?: unknown, extra?: Record<string, unknown>) {
  const properties: Array<{ name: string; value?: unknown }> = [
    { name: WHITEBOARD_PAGE_PROP, value: flag },
  ];
  if (arguments.length >= 2) properties.push({ name: "cards", value: cards });
  return { aliases: ["Page Board"], text: "ignored", properties, ...extra };
}

function inlineBoard(cards?: unknown) {
  const properties: Array<{ name: string; value?: unknown }> = [
    { name: "_repr", value: { type: "whiteboard.canvas" } },
  ];
  if (arguments.length >= 1) properties.push({ name: "cards", value: cards });
  return { aliases: [], text: "Inline Board", properties };
}

check(readBoardCardInfo(undefined) === null, "missing block is not a board");
check(readBoardCardInfo({}) === null, "plain block is not a board");
check(
  readBoardCardInfo({ properties: [] }) === null,
  "empty properties is not a board",
);
check(
  readBoardCardInfo({
    properties: [{ name: WHITEBOARD_PAGE_PROP, value: false }],
  }) === null,
  "whiteboardPage false is not a board",
);
check(
  readBoardCardInfo({
    properties: [{ name: WHITEBOARD_PAGE_PROP, value: 0 }],
  }) === null,
  "whiteboardPage 0 is not a board",
);

const fromTrue = readBoardCardInfo(pageBoard(true, cardJson(3)));
check(fromTrue != null, "whiteboardPage true is a board");
check(fromTrue?.name === "Page Board", "name uses first alias");
check(fromTrue?.count === 3, "card count from cards property");

const fromOne = readBoardCardInfo(pageBoard(1, cardJson(1)));
check(fromOne != null && fromOne.count === 1, "whiteboardPage 1 is a board");

const fromTrueStr = readBoardCardInfo(pageBoard("true", cardJson(2)));
check(
  fromTrueStr != null && fromTrueStr.count === 2,
  'whiteboardPage "true" is a board',
);

const inline = readBoardCardInfo(inlineBoard(cardJson(4)));
check(inline != null, "inline _repr.type whiteboard.canvas is a board");
check(inline?.name === "Inline Board", "name falls back to text");
check(inline?.count === 4, "inline board card count");

const unnamed = readBoardCardInfo({
  properties: [{ name: WHITEBOARD_PAGE_PROP, value: true }],
});
check(unnamed != null, "flag-only block is a board");
check(unnamed?.name === "Whiteboard", "name falls back to Whiteboard");
check(unnamed?.count === 0, "missing cards property counts as 0");

const badJson = readBoardCardInfo(pageBoard(true, "{not-json"));
check(badJson != null, "unreadable cards still identifies as a board");
check(badJson?.count === null, "bad JSON cards → count null");

const notArray = readBoardCardInfo(pageBoard(true, "{}"));
check(notArray?.count === null, "non-array cards JSON → count null");

check(
  boardCardInfoEqual(null, null) === true,
  "null boards compare equal",
);
check(
  boardCardInfoEqual(null, { name: "A", count: 0 }) === false,
  "null vs board is not equal",
);
check(
  boardCardInfoEqual({ name: "A", count: 1 }, { name: "A", count: 1 }) === true,
  "same board info is equal",
);
check(
  boardCardInfoEqual({ name: "A", count: 1 }, { name: "B", count: 1 }) === false,
  "name change is not equal",
);
check(
  boardCardInfoEqual({ name: "A", count: 1 }, { name: "A", count: 2 }) === false,
  "count change is not equal",
);
check(
  boardCardInfoEqual({ name: "A", count: null }, { name: "A", count: 0 }) ===
    false,
  "unreadable vs empty is not equal",
);

const view = {
  exists: true,
  text: "hi",
  childCount: 0,
  excerpt: "hi",
  board: null as ReturnType<typeof readBoardCardInfo>,
};
check(
  cardBlockViewEqual(view, { ...view }) === true,
  "cardBlockViewEqual same snapshot",
);
check(
  cardBlockViewEqual(view, { ...view, board: { name: "A", count: 0 } }) ===
    false,
  "cardBlockViewEqual detects board appearing",
);
check(
  cardBlockViewEqual(
    { ...view, board: { name: "A", count: 1 } },
    { ...view, board: { name: "A", count: 2 } },
  ) === false,
  "cardBlockViewEqual detects count change",
);
check(
  cardBlockViewEqual(
    { ...view, board: { name: "A", count: 1 } },
    { ...view, board: { name: "B", count: 1 } },
  ) === false,
  "cardBlockViewEqual detects name change",
);

console.log("boardCardView.test.ts ok");
