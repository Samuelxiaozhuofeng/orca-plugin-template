// @ts-nocheck — Node assertion script; tsc has no @types/node in this package.
import { register } from "node:module";

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
  dbIdsFromBroadcastArgs,
  indexedBoardIdsFromOps,
  shouldDropIndexedBoard,
} = await import("./blockMarkWatch.ts");

function check(cond, message) {
  if (!cond) throw new Error(message);
}

const indexed = new Set([10, 20, 30]);

check(
  JSON.stringify(dbIdsFromBroadcastArgs([[10, 20]])) === "[10,20]",
  "broadcast payload as one id array",
);
check(
  JSON.stringify(dbIdsFromBroadcastArgs([10, 20])) === "[10,20]",
  "broadcast payload as rest args",
);
check(
  JSON.stringify(dbIdsFromBroadcastArgs([[10], 10, "20", "x"])) === "[10,20]",
  "broadcast ids de-dupe and skip junk",
);

check(shouldDropIndexedBoard(null) === true, "missing block is gone");
check(shouldDropIndexedBoard(undefined) === true, "undefined block is gone");
check(
  shouldDropIndexedBoard({
    properties: [{ name: "_repr", value: { type: "text" } }],
  }) === true,
  "plain outline is not a board",
);
check(
  shouldDropIndexedBoard({
    properties: [{ name: "_repr", value: { type: "whiteboard.canvas" } }],
  }) === false,
  "inline whiteboard stays",
);
check(
  shouldDropIndexedBoard({
    properties: [{ name: "whiteboardPage", value: true }],
  }) === false,
  "page whiteboard stays",
);
check(
  shouldDropIndexedBoard({
    properties: [{ name: "whiteboardPage", value: false }],
  }) === true,
  "cleared page flag is gone",
);

const deleted = indexedBoardIdsFromOps(
  [["delete", ["10"], { id: 10 }]],
  indexed,
);
check(JSON.stringify(deleted?.deleted) === "[10]", "top-level delete");
check(JSON.stringify(deleted?.touched) === "[]", "delete is not also touched");

const nestedRepr = indexedBoardIdsFromOps(
  [["set", ["20", "properties"], []]],
  indexed,
);
check(JSON.stringify(nestedRepr?.deleted) === "[]", "nested write is not delete");
check(
  JSON.stringify(nestedRepr?.touched) === "[20]",
  "nested write on an indexed board is touched",
);

const other = indexedBoardIdsFromOps(
  [
    ["set", ["99"], {}],
    ["delete", ["88"], {}],
  ],
  indexed,
);
check(JSON.stringify(other?.deleted) === "[]", "unknown delete ignored");
check(JSON.stringify(other?.touched) === "[]", "unknown set ignored");

const mixed = indexedBoardIdsFromOps(
  [
    ["delete", ["10"], {}],
    ["set", ["10", "text"], "x"],
    ["set", ["30", "_repr"], { type: "text" }],
  ],
  indexed,
);
check(JSON.stringify(mixed?.deleted) === "[10]", "mixed keeps the delete");
check(
  JSON.stringify(mixed?.touched) === "[30]",
  "mixed does not re-touch a deleted id",
);

check(indexedBoardIdsFromOps(undefined, indexed) === null, "missing ops");
check(indexedBoardIdsFromOps("nope", indexed) === null, "non-array ops");
check(
  indexedBoardIdsFromOps([["set"]], indexed) === null,
  "malformed op is rejected",
);

console.log("blockMarkWatch.test.ts ok");
