import {
  formatDeleteConfirmItems,
  isCardShellBlock,
} from "./cardShell.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

// 1. 空文本+无子块+无引用 → 空壳
check(
  isCardShellBlock({ text: "", children: [], backRefs: [] }) === true,
  "empty text, no children, no backRefs is a shell",
);
check(
  isCardShellBlock({ text: "   \t\n  ", children: [], backRefs: [] }) === true,
  "whitespace text, no children, no backRefs is a shell",
);
check(
  isCardShellBlock({
    text: "",
    content: [{ t: "text", v: "  " }],
    children: [],
    backRefs: [],
  }) === true,
  "whitespace content fragments is a shell",
);
check(
  isCardShellBlock({
    children: [],
    backRefs: [],
  }) === true,
  "missing text and content with no children and no backRefs is a shell",
);

// 2. 有文本 → 非空壳
check(
  isCardShellBlock({ text: "Hello", children: [], backRefs: [] }) === false,
  "non-empty text is not a shell",
);
check(
  isCardShellBlock({
    text: "",
    content: [{ t: "text", v: "non-empty" }],
    children: [],
    backRefs: [],
  }) === false,
  "non-empty content fragment is not a shell",
);
check(
  isCardShellBlock({
    text: "",
    content: [{ t: "link", v: "https://example.com" }],
    children: [],
    backRefs: [],
  }) === false,
  "non-text content fragment is not a shell",
);

// 3. 有子块 → 非空壳
check(
  isCardShellBlock({ text: "", children: [123], backRefs: [] }) === false,
  "has children is not a shell",
);
check(
  isCardShellBlock({ text: "   ", children: [1, 2], backRefs: [] }) === false,
  "whitespace text with children is not a shell",
);

// 4. 有反向引用 → 非空壳
check(
  isCardShellBlock({
    text: "",
    children: [],
    backRefs: [{ from: 456, to: 123 }],
  }) === false,
  "has backRefs is not a shell",
);

// 5. 是白板块 → 非空壳
check(
  isCardShellBlock({
    text: "",
    children: [],
    backRefs: [],
    properties: [{ name: "_repr", value: { type: "whiteboard.canvas" } }],
  }) === false,
  "inline whiteboard is not a shell",
);
check(
  isCardShellBlock({
    text: "",
    children: [],
    backRefs: [],
    _repr: { type: "whiteboard.canvas" },
  }) === false,
  "direct _repr whiteboard is not a shell",
);
check(
  isCardShellBlock({
    text: "",
    children: [],
    backRefs: [],
    properties: [{ name: "whiteboardPage", value: true }],
  }) === false,
  "page whiteboard is not a shell",
);
check(
  isCardShellBlock({
    text: "",
    children: [],
    backRefs: [],
    properties: [{ name: "whiteboardPage", value: 1 }],
  }) === false,
  "page whiteboard with value 1 is not a shell",
);

// 6. 判定信息缺失 → 非空壳 (保守路径)
check(
  isCardShellBlock(null) === false,
  "null block is not a shell",
);
check(
  isCardShellBlock(undefined) === false,
  "undefined block is not a shell",
);
check(
  isCardShellBlock("string" as unknown) === false,
  "non-object block is not a shell",
);
check(
  isCardShellBlock({ text: "", children: [] }) === false,
  "missing backRefs is not a shell",
);
check(
  isCardShellBlock({ text: "", backRefs: [] }) === false,
  "missing children is not a shell",
);
check(
  isCardShellBlock({
    text: 123 as unknown as string,
    children: [],
    backRefs: [],
  }) === false,
  "invalid text type is not a shell",
);

// 7. 媒体与文件块 → 非空壳
check(
  isCardShellBlock({
    text: "",
    children: [],
    backRefs: [],
    _repr: { type: "image" },
  }) === false,
  "image block is not a shell",
);
check(
  isCardShellBlock({
    text: "",
    children: [],
    backRefs: [],
    _repr: { type: "pdf" },
  }) === false,
  "pdf block is not a shell",
);
check(
  isCardShellBlock({
    text: "",
    children: [],
    backRefs: [],
    _repr: { type: "file" },
  }) === false,
  "file block is not a shell",
);

// 8. 确认列表项截断测试
const items5 = formatDeleteConfirmItems(["A", "B", "C", "D", "E"], 8);
check(items5.shown.length === 5, "5 items all shown");
check(items5.remainingCount === 0, "5 items 0 remaining");

const items10 = formatDeleteConfirmItems(
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  8,
);
check(items10.shown.length === 8, "10 items shows first 8");
check(items10.remainingCount === 2, "10 items 2 remaining");

console.log("cardShell tests passed");

// 7. 有别名（已命名的页面）→ 非空壳
check(
  isCardShellBlock({
    text: "",
    children: [],
    backRefs: [],
    aliases: ["Some page"],
  }) === false,
  "a named page is not a shell",
);
