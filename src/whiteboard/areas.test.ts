import {
  areasPropertyPresent,
  parseAreas,
  readAreas,
  shouldPersistAreas,
  tryParseAreas,
  tryReadAreas,
} from "./areas.ts";
import { boardPropsReadable } from "./boardWrite.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function area(
  id: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return { id, x: 10, y: 20, w: 240, h: 160, name: "Section", ...extra };
}

function board(areas?: unknown) {
  const properties: Array<{ name: string; value?: unknown }> = [];
  if (arguments.length >= 1) properties.push({ name: "areas", value: areas });
  return { properties };
}

function isOk<T>(
  result: { ok: true; value: T } | { ok: false },
): result is { ok: true; value: T } {
  return result.ok;
}

function isDropped(
  result: { ok: true } | { ok: false; reason?: string; dropped?: number },
): result is { ok: false; reason: "bad-items"; dropped: number } {
  return !result.ok && result.reason === "bad-items";
}

function isNotArray(
  result: { ok: true } | { ok: false; reason?: string },
): boolean {
  return !result.ok && result.reason === "not-array";
}

const two = [area("area-1"), area("area-2", { x: 300, name: "B" })];
const ok = tryParseAreas(two);
check(isOk(ok) && ok.value.length === 2, "valid areas array");
check(ok.ok && ok.value[0].id === "area-1", "first area id is kept");
check(ok.ok && ok.value[1].name === "B", "second area name is kept");
check(
  isOk(tryParseAreas(JSON.stringify(two))) &&
    (tryParseAreas(JSON.stringify(two)) as { value: unknown[] }).value.length ===
      2,
  "valid areas JSON string",
);

for (const [label, value] of [
  ["object", { areas: [] }],
  ["string", "nope"],
  ["number", 42],
  ["JSON object", "{}"],
] as const) {
  check(isNotArray(tryParseAreas(value)), `areas ${label} is not-array`);
}

check(readAreas(board("{}")).length === 0, "readAreas non-array is empty");
check(parseAreas("x").length === 0, "parseAreas non-array is empty");

const mixed = [
  area("area-1"),
  { id: "bad", x: "no", y: 0, w: 1, h: 1, name: "x" },
  area("area-3"),
];
const mixedResult = tryParseAreas(mixed);
check(!isOk(mixedResult), "mixed areas protect");
check(
  isDropped(mixedResult) && mixedResult.dropped === 1,
  "mixed areas dropped count is 1",
);

const nanItem = [area("area-1", { x: Number.NaN })];
const nanResult = tryParseAreas(nanItem);
check(!isOk(nanResult), "NaN coordinate protects");
check(isDropped(nanResult) && nanResult.dropped === 1, "NaN dropped count is 1");

const missing = [{ x: 1, y: 2, w: 3, h: 4, name: "x" }];
const missingResult = tryParseAreas(missing);
check(
  isDropped(missingResult) && missingResult.dropped === 1,
  "missing id is dropped and counted",
);

check(!tryReadAreas(board(mixed)).ok, "tryReadAreas mixed protects");
check(!boardPropsReadable(board(mixed)), "mixed areas make the board unreadable");

const legacy = {};
const missingProp = tryReadAreas(legacy);
check(isOk(missingProp) && missingProp.value.length === 0, "legacy board is empty");
check(!areasPropertyPresent(legacy), "legacy board has no areas property");
check(
  isOk(missingProp) &&
    shouldPersistAreas(missingProp.value, areasPropertyPresent(legacy)) ===
      false,
  "legacy empty areas must not be written",
);
check(isOk(tryReadAreas(undefined)), "tryReadAreas missing block");
check(isOk(tryReadAreas({ properties: [] })), "tryReadAreas empty properties");
check(
  boardPropsReadable({ properties: [] }),
  "legacy board without areas stays readable",
);

console.log("areas.test.ts ok");
