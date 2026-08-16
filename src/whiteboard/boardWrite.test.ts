import {
  hasBoardLayoutProps,
  isBoardWriteRetryCurrent,
  type BoardWritePayload,
} from "./boardWrite.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function payload(
  gen: number,
  blockId = 1,
): BoardWritePayload {
  return {
    blockId,
    gen,
    props: [{ name: "cards", type: 1, value: "[]" }],
  };
}

const first = payload(1);
const second = payload(2);
check(
  isBoardWriteRetryCurrent(first, first) === true,
  "retry matches the latest attempt",
);
check(
  isBoardWriteRetryCurrent(first, second) === false,
  "older failed snapshot is stale after a newer write",
);
check(
  isBoardWriteRetryCurrent(second, first) === false,
  "a future gen is not current if latest is older",
);
check(
  isBoardWriteRetryCurrent(null, first) === false,
  "missing payload is not current",
);
check(
  isBoardWriteRetryCurrent(first, undefined) === false,
  "no latest write means retry is not current",
);
check(
  isBoardWriteRetryCurrent(payload(1, 9), payload(1, 8)) === false,
  "same gen on another board is not current",
);

check(hasBoardLayoutProps(undefined) === false, "missing block is incomplete");
check(hasBoardLayoutProps({}) === false, "no properties array is incomplete");
check(
  hasBoardLayoutProps({ properties: [] }) === false,
  "empty properties is incomplete",
);
check(
  hasBoardLayoutProps({
    properties: [{ name: "_repr" }, { name: "whiteboardPage" }],
  }) === false,
  "type/flag-only stub is incomplete",
);
check(
  hasBoardLayoutProps({
    properties: [{ name: "cards" }],
  }) === false,
  "cards without edges is incomplete",
);
check(
  hasBoardLayoutProps({
    properties: [{ name: "cards" }, { name: "edges" }],
  }) === true,
  "cards+edges listed is complete even without areas",
);
check(
  hasBoardLayoutProps({
    properties: [{ name: "cards" }, { name: "edges" }, { name: "areas" }],
  }) === true,
  "all three layout props listed is complete",
);

console.log("boardWrite.test.ts ok");
