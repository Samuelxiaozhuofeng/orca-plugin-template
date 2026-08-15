// @ts-nocheck — Node assertion script; tsc has no @types/node in this package.

const g = globalThis as typeof globalThis & {
  window: {
    Valtio: {
      subscribe: (
        target: object,
        cb: (ops?: unknown) => void,
        sync?: boolean,
      ) => () => void;
    };
  };
  orca: { state: { blocks: Record<number, object | undefined> } };
};

const mapListeners = new Set<(ops?: unknown) => void>();
let subscribeCalls = 0;

g.window = {
  ...(g.window ?? {}),
  Valtio: {
    subscribe: (_target, cb) => {
      subscribeCalls += 1;
      mapListeners.add(cb);
      return () => {
        subscribeCalls -= 1;
        mapListeners.delete(cb);
      };
    },
  },
};

g.orca = { state: { blocks: { 1: { id: 1 }, 2: { id: 2 } } } };

const {
  blockPresenceInspectCount,
  blockPresenceMapSubscribed,
  blockPresenceWatcherCount,
  idsReplacedIn,
  registerBlockPresence,
  resetBlockPresenceForTests,
  resetBlockPresenceInspectCount,
  topLevelBlockIdsFromOps,
} = await import("./blockPresence.ts");

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function fireMap(ops?: unknown): void {
  for (const listener of [...mapListeners]) listener(ops);
}

function nestedTextOp(id: number) {
  return [["set", [String(id), "text"], "x", "y"]];
}

function setKeyOp(id: number, next: object, prev: object) {
  return [["set", [String(id)], next, prev]];
}

function deleteKeyOp(id: number, prev: object) {
  return [["delete", [String(id)], prev]];
}

resetBlockPresenceForTests();
subscribeCalls = 0;
mapListeners.clear();

const hits: number[] = [];
const handles = [];
for (let i = 0; i < 40; i++) {
  const n = i;
  const handle = registerBlockPresence(() => {
    hits[n] = (hits[n] ?? 0) + 1;
  });
  handle.setIds([n + 1]);
  handles.push(handle);
}

check(handles.length === 40, "40 cards registered");
check(blockPresenceWatcherCount() === 40, "40 watchers are live");
check(blockPresenceMapSubscribed() === true, "the blocks map is subscribed");
check(subscribeCalls === 1, "N cards share a single blocks-map subscribe");

resetBlockPresenceInspectCount();
fireMap(nestedTextOp(99));
check(blockPresenceInspectCount() === 0, "nested field ops do no id inspects");
check(
  hits.every((n) => n == null || n === 0),
  "nested field ops do not fan out",
);

const next1 = { id: 1, rev: 2 };
g.orca.state.blocks[1] = next1;
fireMap(setKeyOp(1, next1, { id: 1 }));
check(hits[0] === 1, "only the watcher whose id was replaced is notified");
check(
  hits.slice(1).every((n) => n == null || n === 0),
  "other watchers stay quiet when their ids are unchanged",
);

const last = { id: 1 };
const lastById = new Map([[1, last]]);
check(
  idsReplacedIn([1], lastById, { 1: last }) === false,
  "same identity is not a replace",
);
check(
  idsReplacedIn([1], lastById, { 1: { id: 1 } }) === true,
  "new identity is a replace",
);
check(idsReplacedIn([1], lastById, {}) === true, "delete is a replace");

check(
  topLevelBlockIdsFromOps(nestedTextOp(1))?.join(",") === "",
  "nested path is not a top-level key change",
);
check(
  topLevelBlockIdsFromOps(setKeyOp(7, {}, {}))?.join(",") === "7",
  "top-level set is a key change",
);
check(
  topLevelBlockIdsFromOps(deleteKeyOp(7, {}))?.join(",") === "7",
  "top-level delete is a key change",
);
check(topLevelBlockIdsFromOps(undefined) === null, "missing ops are malformed");

for (const handle of handles) handle.dispose();
check(blockPresenceWatcherCount() === 0, "all watchers released");
check(blockPresenceMapSubscribed() === false, "map subscribe drops with last watcher");
check(subscribeCalls === 0, "the shared subscribe was unsubscribed");

resetBlockPresenceForTests();
subscribeCalls = 0;
mapListeners.clear();
const many = [];
for (let i = 0; i < 1000; i++) {
  const ids = [];
  for (let n = 0; n < 80; n++) ids.push(i * 80 + n + 1);
  const handle = registerBlockPresence(() => undefined);
  handle.setIds(ids);
  many.push(handle);
}
resetBlockPresenceInspectCount();
fireMap(nestedTextOp(1));
const inspectAt1000 = blockPresenceInspectCount();
check(inspectAt1000 === 0, "1000 watchers × 80 ids: nested write inspects 0 ids");

const few = many.slice(0, 10);
for (const handle of many.slice(10)) handle.dispose();
resetBlockPresenceInspectCount();
fireMap(nestedTextOp(1));
check(
  blockPresenceInspectCount() === inspectAt1000,
  "nested-write inspect count does not grow with watcher count",
);

resetBlockPresenceInspectCount();
const replaced = { id: 1 };
g.orca.state.blocks[1] = replaced;
fireMap(setKeyOp(1, replaced, { id: 1 }));
check(
  blockPresenceInspectCount() === 1,
  "one top-level key does one reverse-map lookup",
);

for (const handle of few) handle.dispose();

console.log("blockPresence.test.ts ok");
