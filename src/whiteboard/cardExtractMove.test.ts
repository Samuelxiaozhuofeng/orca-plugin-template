import {
  canRestoreExtract,
  isExtractStubBlock,
  lastChildLeftId,
  originFromBlock,
  parseExtractRestore,
  parseExtractStubMeta,
  planBoardAfterRestore,
  planRestoreAnchor,
  referencedBlockIds,
  serializeExtractRestore,
  type ExtractRestoreInfo,
} from "./cardExtractModel.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

check(lastChildLeftId([]) == null, "empty children have no left");
check(lastChildLeftId([1, 2, 3]) === 3, "last child is left for lastChild");
check(
  lastChildLeftId([1, 2, 3], new Set([3])) === 2,
  "skip a moving last child",
);
check(
  lastChildLeftId([1], new Set([1])) == null,
  "only moving child leaves null left",
);

check(
  JSON.stringify(originFromBlock({ parent: 10, left: 4 })) ===
    JSON.stringify({ originParentId: 10, originLeftId: 4 }),
  "origin keeps parent and left",
);
check(
  JSON.stringify(originFromBlock({ parent: 10 })) ===
    JSON.stringify({ originParentId: 10, originLeftId: null }),
  "first child has null left",
);
check(originFromBlock({}) == null, "root has no origin");
check(originFromBlock(null) == null, "missing block has no origin");

check(
  JSON.stringify(
    planRestoreAnchor({
      originParentId: 1,
      originLeftId: 2,
      stubId: 9,
      parentChildren: [2, 9, 3],
    }),
  ) === JSON.stringify({ parentId: 1, leftId: 2 }),
  "restore uses origin left when it is still a sibling",
);
check(
  JSON.stringify(
    planRestoreAnchor({
      originParentId: 1,
      originLeftId: 2,
      stubId: 9,
      parentChildren: [9, 3],
    }),
  ) === JSON.stringify({ parentId: 1, leftId: null }),
  "restore sits before the stub when origin left is gone",
);
check(
  JSON.stringify(
    planRestoreAnchor({
      originParentId: 1,
      originLeftId: 2,
      stubId: 9,
      parentChildren: [5, 9, 3],
    }),
  ) === JSON.stringify({ parentId: 1, leftId: 5 }),
  "restore uses the sibling before the stub",
);
check(
  JSON.stringify(
    planRestoreAnchor({
      originParentId: 1,
      originLeftId: 2,
      stubId: 9,
    }),
  ) === JSON.stringify({ parentId: 1, leftId: 2 }),
  "restore trusts stored origin when children are unknown",
);
check(
  JSON.stringify(
    planRestoreAnchor({
      originParentId: 1,
      originLeftId: 2,
      stubId: 9,
      parentChildren: [5, 3],
    }),
  ) === JSON.stringify({ parentId: 1, leftId: 3 }),
  "restore appends when neither origin left nor stub remains",
);

const info: ExtractRestoreInfo = {
  movedId: 20,
  sourceCardId: 10,
  originParentId: 11,
  originLeftId: 12,
  stubId: 30,
  boardBlockId: 1,
};
check(
  JSON.stringify(parseExtractRestore(serializeExtractRestore(info))) ===
    JSON.stringify(info),
  "restore info roundtrip",
);
check(
  parseExtractRestore(
    JSON.stringify({ ...info, originLeftId: null, sourceCardId: null }),
  )?.originLeftId == null,
  "restore info allows null left and source",
);
check(parseExtractRestore("") == null, "empty restore info");
check(parseExtractRestore("{") == null, "broken restore info");
check(
  parseExtractRestore(JSON.stringify({ movedId: 20 })) == null,
  "incomplete restore info",
);
check(
  parseExtractRestore({
    movedId: 20,
    sourceCardId: 10,
    originParentId: 11,
    originLeftId: 12,
    stubId: 30,
    boardBlockId: 1,
  })?.stubId === 30,
  "restore info accepts a plain object",
);
check(canRestoreExtract({ properties: [] }) === false, "no prop cannot restore");
check(
  canRestoreExtract({
    properties: [
      { name: "_owbExtractFrom", value: serializeExtractRestore(info) },
    ],
  }) === true,
  "extractFrom prop can restore",
);

check(
  parseExtractStubMeta(JSON.stringify({ to: 20, source: 10 }))?.to === 20,
  "stub meta parses",
);
check(parseExtractStubMeta("nope") == null, "bad stub meta");

check(
  referencedBlockIds([{ t: "r", v: 99 }], [{ id: 99, to: 20, type: 1 }]).join(
    ",",
  ) === "20",
  "content r fragment resolves through refs",
);
check(
  referencedBlockIds([{ t: "r", v: 20 }], []).join(",") === "20",
  "content r fragment falls back to v",
);
check(
  isExtractStubBlock(
    {
      properties: [
        { name: "_owbExtractStub", value: JSON.stringify({ to: 20 }) },
      ],
    },
    20,
  ) === true,
  "stub property identifies the extract stub",
);
check(
  isExtractStubBlock(
    {
      properties: [
        { name: "_owbExtractStub", value: JSON.stringify({ to: 21 }) },
      ],
    },
    20,
  ) === false,
  "stub property must match the moved id",
);
check(
  isExtractStubBlock(
    {
      content: [{ t: "r", v: 99 }],
      refs: [{ id: 99, to: 20, type: 1 }],
    },
    20,
  ) === true,
  "single inline ref identifies a stub when the property is missing",
);
check(
  isExtractStubBlock(
    { content: [{ t: "t", v: "plain" }], refs: [] },
    20,
  ) === false,
  "plain text is not a stub",
);

const board = planBoardAfterRestore(
  [
    { blockId: 10, kind: "block", x: 0, y: 0, w: 1, h: 1 },
    { blockId: 20, kind: "block", x: 2, y: 0, w: 1, h: 1 },
  ],
  [
    { id: "10-20-1", from: 10, to: 20, arrow: "end" },
    { id: "10-30-1", from: 10, to: 30, arrow: "end" },
  ],
  [info],
);
check(
  board.cards.map((card) => card.blockId).join(",") === "10",
  "restore removes the extracted card",
);
check(
  board.edges.map((edge) => edge.id).join(",") === "10-30-1",
  "restore removes edges touching the extracted card",
);

console.log("cardExtractMove.test.ts ok");
