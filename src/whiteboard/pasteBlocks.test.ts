import {
  parseDroppedBlockIds,
  parsePasteLines,
  planPasteClipboard,
  type RawContentFragment,
  resolvePasteTarget,
  rewriteFragmentsWithRefs,
} from "./pasteBlocks.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function mockDataTransfer(
  types: Record<string, string>,
): { getData: (format: string) => string; types: string[] } {
  return {
    getData: (format: string) => types[format] ?? "",
    types: Object.keys(types),
  };
}

// 1. parsePasteLines tests
check(parsePasteLines(null).length === 0, "null text returns empty array");
check(
  parsePasteLines(undefined).length === 0,
  "undefined text returns empty array",
);
check(parsePasteLines("").length === 0, "empty string returns empty array");
check(
  parsePasteLines("   \t  \n  \r\n   ").length === 0,
  "whitespace string returns empty array",
);

const singleLine = parsePasteLines("  Hello world  ");
check(
  singleLine.length === 1 && singleLine[0] === "Hello world",
  "single line is trimmed",
);

const multiLine = parsePasteLines(
  "\n  First line  \n\n   \n  Second line  \n  Third line  \n\n",
);
check(
  multiLine.length === 3 &&
    multiLine[0] === "First line" &&
    multiLine[1] === "Second line" &&
    multiLine[2] === "Third line",
  "multi line splits, trims each line, and ignores empty lines",
);

const crlfLines = parsePasteLines("Line 1\r\nLine 2\r\n\r\nLine 3\r\n");
check(
  crlfLines.length === 3 &&
    crlfLines[0] === "Line 1" &&
    crlfLines[1] === "Line 2" &&
    crlfLines[2] === "Line 3",
  "handles windows CRLF line breaks correctly",
);

// 2. planPasteClipboard and format tests
const TEST_REPO_MIME = "orca/test-repo";
const TEST_WEB_MIME = "web orca/test-repo";

// 2.1 Null data transfer
const nullPlan = planPasteClipboard(null, TEST_REPO_MIME);
check(nullPlan.kind === "none", "null dataTransfer results in none plan");

// 2.2 web orca/<repo> blocks in clipboard (Web Custom Format with prefix)
const dtWebOrcaBlocks = mockDataTransfer({
  [TEST_WEB_MIME]: JSON.stringify({
    repoId: "test-repo",
    blocks: [1001, 1002, 1003],
  }),
});
const planWebOrca = planPasteClipboard(dtWebOrcaBlocks, TEST_REPO_MIME);
check(
  planWebOrca.kind === "blocks",
  "web orca/<repo> blocks recognised as blocks plan",
);
if (planWebOrca.kind === "blocks") {
  check(
    planWebOrca.ids.join(",") === "1001,1002,1003",
    "web orca block IDs parsed correctly",
  );
}

// 2.3 Legacy orca/<repo> without web prefix (drag-and-drop format)
const dtLegacyOrcaBlocks = mockDataTransfer({
  [TEST_REPO_MIME]: JSON.stringify({ blocks: [3001, 3002] }),
});
const planLegacyOrca = planPasteClipboard(dtLegacyOrcaBlocks, TEST_REPO_MIME);
check(
  planLegacyOrca.kind === "blocks",
  "legacy orca/<repo> blocks recognised as blocks plan",
);
if (planLegacyOrca.kind === "blocks") {
  check(
    planLegacyOrca.ids.join(",") === "3001,3002",
    "legacy orca block IDs parsed correctly",
  );
}

// 2.4 parseDroppedBlockIds supports both web and non-web formats, but ignores fragments
const droppedWebIds = parseDroppedBlockIds(dtWebOrcaBlocks, TEST_REPO_MIME);
check(
  droppedWebIds.join(",") === "1001,1002,1003",
  "parseDroppedBlockIds supports web orca/<repo>",
);

const droppedLegacyIds = parseDroppedBlockIds(
  dtLegacyOrcaBlocks,
  TEST_REPO_MIME,
);
check(
  droppedLegacyIds.join(",") === "3001,3002",
  "parseDroppedBlockIds supports legacy orca/<repo>",
);

// 2.5 fragments payload (e.g. copied text selection / PDF highlight with 📌)
const pdfHighlightPayload = {
  repoId: "test-repo",
  blocks: [5000], // source block ID (e.g. PDF block), must NOT become card
  fragments: [
    {
      t: "r",
      to: 9999,
      alias: "x",
      a: "📌",
      vArgs: { page: 2, x: 0.1, y: 0.2 },
    },
    { t: "t", v: " Highlighted text in PDF" },
  ],
  fromBackRefsMode: false,
};

const dtFragments = mockDataTransfer({
  [TEST_WEB_MIME]: JSON.stringify(pdfHighlightPayload),
  "text/plain": "📌 Highlighted text in PDF",
});

const planFragments = planPasteClipboard(dtFragments, TEST_REPO_MIME);
check(
  planFragments.kind === "fragments",
  "payload with fragments recognised as fragments plan (not blocks)",
);
if (planFragments.kind === "fragments") {
  check(
    planFragments.fragments.length === 2,
    "fragments array contains all content fragments",
  );
  check(
    planFragments.fragments[0].t === "r" &&
      planFragments.fragments[0].to === 9999 &&
      planFragments.fragments[0].a === "📌",
    "reference fragment preserved in fragments plan",
  );
}

// parseDroppedBlockIds must return empty array for fragments payload
const droppedFromFragments = parseDroppedBlockIds(
  dtFragments,
  TEST_REPO_MIME,
);
check(
  droppedFromFragments.length === 0,
  "parseDroppedBlockIds ignores payload containing fragments so source block is not dropped",
);

// 2.6 Orca payload takes priority over plain text if both exist
const dtOrcaAndText = mockDataTransfer({
  [TEST_WEB_MIME]: JSON.stringify({ blocks: [2001] }),
  "text/plain": "Some plain text content",
});
const planOrcaPriority = planPasteClipboard(dtOrcaAndText, TEST_REPO_MIME);
check(
  planOrcaPriority.kind === "blocks",
  "web orca blocks take priority over plain text",
);

// 2.7 Highlight payload is skipped from blocks
const dtHighlight = mockDataTransfer({
  [TEST_REPO_MIME]: JSON.stringify({ highlight: 999 }),
  "text/plain": "Highlighted text content",
});
const planHighlight = planPasteClipboard(dtHighlight, TEST_REPO_MIME);
check(
  planHighlight.kind === "text",
  "highlight payload is ignored and falls back to plain text",
);

// 2.8 Plain text only (multi-line)
const dtPlainText = mockDataTransfer({
  "text/plain": "\n  Card Title  \n\n  Child Item 1  \n  Child Item 2  \n",
});
const planText = planPasteClipboard(dtPlainText, TEST_REPO_MIME);
check(planText.kind === "text", "plain text recognised as text plan");
if (planText.kind === "text") {
  check(planText.title === "Card Title", "first line parsed as card title");
  check(
    planText.children.join(",") === "Child Item 1,Child Item 2",
    "subsequent lines parsed as child blocks",
  );
  check(
    planText.lines.join(",") === "Card Title,Child Item 1,Child Item 2",
    "lines array contains all trimmed lines",
  );
}

// 2.9 Plain text only (single line)
const dtSingleText = mockDataTransfer({
  "text/plain": "  Solo note card  ",
});
const planSingle = planPasteClipboard(dtSingleText, TEST_REPO_MIME);
check(planSingle.kind === "text", "single line text recognised as text plan");
if (planSingle.kind === "text") {
  check(planSingle.title === "Solo note card", "single line is title");
  check(planSingle.children.length === 0, "no child blocks for single line");
}

// 2.10 Pure whitespace plain text -> none
const dtWhitespaceText = mockDataTransfer({
  "text/plain": "   \n\t  \r\n   ",
});
const planWhitespace = planPasteClipboard(dtWhitespaceText, TEST_REPO_MIME);
check(
  planWhitespace.kind === "none",
  "pure whitespace text results in none plan",
);

// 2.11 Neither Orca blocks nor text (e.g. image clipboard) -> none
const dtEmpty = mockDataTransfer({});
const planEmpty = planPasteClipboard(dtEmpty, TEST_REPO_MIME);
check(
  planEmpty.kind === "none",
  "empty clipboard (e.g. image) results in none plan",
);

// 3. rewriteFragmentsWithRefs tests
async function runFragmentRewriteTests(): Promise<void> {
  const inputFragments: RawContentFragment[] = [
    {
      t: "r",
      to: 9,
      alias: "x",
      a: "📌",
      vArgs: { page: 2, x: 0.1, y: 0.2 },
    },
    {
      t: "t",
      v: " Quote from book",
    },
  ];

  // 3.1 Successful ref rewrite: refId=77
  const rewrittenSuccess = await rewriteFragmentsWithRefs(
    inputFragments,
    async (toId, alias) => {
      check(toId === 9, "createRef called with target block ID");
      check(alias === "x", "createRef called with alias");
      return 77;
    },
  );

  check(
    rewrittenSuccess.length === 2,
    "rewritten fragments has same length as input",
  );
  const refFrag = rewrittenSuccess[0];
  check(refFrag.t === "r", "ref fragment type is 'r'");
  check(refFrag.v === 77, "ref fragment value is rewritten to refId 77");
  check(refFrag.a === "📌", "ref fragment 'a' (📌) is preserved");
  check(
    refFrag.vArgs?.page === 2 &&
      refFrag.vArgs?.x === 0.1 &&
      refFrag.vArgs?.y === 0.2,
    "ref fragment 'vArgs' coordinate is preserved",
  );
  check(!("to" in refFrag), "'to' property is deleted");
  check(!("alias" in refFrag), "'alias' property is deleted");
  check(
    rewrittenSuccess[1].t === "t" &&
      rewrittenSuccess[1].v === " Quote from book",
    "plain text fragment preserved",
  );

  // 3.2 Ref creation failure: degrades to plain text without failing other fragments
  const multiFragmentsWithFail: RawContentFragment[] = [
    {
      t: "r",
      to: 101,
      alias: "good_ref",
      a: "📌",
      vArgs: { page: 1, x: 0, y: 0 },
    },
    {
      t: "r",
      to: 404,
      alias: "broken_ref",
      a: "📌",
      vArgs: { page: 3, x: 0, y: 0 },
    },
    {
      t: "t",
      v: " End of notes",
    },
  ];

  const rewrittenWithFail = await rewriteFragmentsWithRefs(
    multiFragmentsWithFail,
    async (toId) => {
      if (toId === 404) {
        throw new Error("Target block not found");
      }
      return 88;
    },
  );

  check(
    rewrittenWithFail.length === 3,
    "fragment array count maintained on partial failure",
  );
  check(
    rewrittenWithFail[0].t === "r" && rewrittenWithFail[0].v === 88,
    "successful ref rewritten properly",
  );
  check(
    rewrittenWithFail[1].t === "t" && rewrittenWithFail[1].v === "broken_ref",
    "failed ref degraded to plain text using alias",
  );
  check(
    rewrittenWithFail[2].t === "t" &&
      rewrittenWithFail[2].v === " End of notes",
    "subsequent text fragment unaffected",
  );
}

await runFragmentRewriteTests();

// 4. resolvePasteTarget tests
const pointerToWorld = (cx: number, cy: number) => ({
  x: cx * 2,
  y: cy * 2,
});

// 4.1 Last pointer client position available
const posWithPointer = resolvePasteTarget({
  lastPointerClient: { clientX: 150, clientY: 250 },
  viewportRect: { left: 50, top: 50, width: 800, height: 600 },
  viewportFallback: { width: 800, height: 600 },
  pointerToWorld,
});
check(
  posWithPointer.x === 300 && posWithPointer.y === 500,
  "uses last mouse position when available",
);

// 4.2 No last pointer, uses viewport rect center
const posWithRect = resolvePasteTarget({
  lastPointerClient: null,
  viewportRect: { left: 100, top: 60, width: 800, height: 600 },
  viewportFallback: { width: 800, height: 600 },
  pointerToWorld,
});
check(
  posWithRect.x === (100 + 400) * 2 && posWithRect.y === (60 + 300) * 2,
  "falls back to viewport center when no mouse position recorded",
);

// 4.3 No last pointer, no viewport rect, uses fallback size center
const posFallback = resolvePasteTarget({
  lastPointerClient: null,
  viewportRect: null,
  viewportFallback: { width: 1000, height: 800 },
  pointerToWorld,
});
check(
  posFallback.x === 500 * 2 && posFallback.y === 400 * 2,
  "falls back to fallback dimensions when viewport rect is null",
);

console.log("pasteBlocks tests passed");

