import { MAX_SCALE, MIN_SCALE } from "./layout.ts";
import { parseStoredView } from "./viewMemory.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function sameView(
  actual: { x: number; y: number; scale: number } | null,
  expected: { x: number; y: number; scale: number },
  message: string,
): void {
  check(actual != null, `${message}: expected a view, got null`);
  check(actual!.x === expected.x, `${message}: x ${actual!.x} !== ${expected.x}`);
  check(actual!.y === expected.y, `${message}: y ${actual!.y} !== ${expected.y}`);
  check(
    actual!.scale === expected.scale,
    `${message}: scale ${actual!.scale} !== ${expected.scale}`,
  );
}

// 1. A well-formed viewport is kept as-is.
sameView(
  parseStoredView({ x: 120.5, y: -40, scale: 1 }),
  { x: 120.5, y: -40, scale: 1 },
  "normal view",
);
sameView(
  parseStoredView({ x: 0, y: 0, scale: 0.8, extra: true }),
  { x: 0, y: 0, scale: 0.8 },
  "extra fields are ignored",
);

// 2. Scale outside the legal range is clamped, not discarded.
sameView(
  parseStoredView({ x: 10, y: 20, scale: 5 }),
  { x: 10, y: 20, scale: MAX_SCALE },
  "scale above max is clamped",
);
sameView(
  parseStoredView({ x: 10, y: 20, scale: 0.1 }),
  { x: 10, y: 20, scale: MIN_SCALE },
  "scale below min is clamped",
);
sameView(
  parseStoredView({ x: 1, y: 2, scale: MIN_SCALE }),
  { x: 1, y: 2, scale: MIN_SCALE },
  "min scale stays min",
);
sameView(
  parseStoredView({ x: 1, y: 2, scale: MAX_SCALE }),
  { x: 1, y: 2, scale: MAX_SCALE },
  "max scale stays max",
);

// 3. Missing / non-numeric / non-finite fields, or a non-object, are rejected.
check(parseStoredView({ x: 1, y: 2 }) == null, "missing scale");
check(parseStoredView({ x: 1, scale: 1 }) == null, "missing y");
check(parseStoredView({ y: 1, scale: 1 }) == null, "missing x");
check(parseStoredView({ x: "1", y: 2, scale: 1 }) == null, "x is a string");
check(parseStoredView({ x: 1, y: "2", scale: 1 }) == null, "y is a string");
check(parseStoredView({ x: 1, y: 2, scale: "1" }) == null, "scale is a string");
check(parseStoredView({ x: NaN, y: 0, scale: 1 }) == null, "x is NaN");
check(parseStoredView({ x: 0, y: NaN, scale: 1 }) == null, "y is NaN");
check(parseStoredView({ x: 0, y: 0, scale: NaN }) == null, "scale is NaN");
check(
  parseStoredView({ x: Infinity, y: 0, scale: 1 }) == null,
  "x is Infinity",
);
check(
  parseStoredView({ x: 0, y: -Infinity, scale: 1 }) == null,
  "y is -Infinity",
);
check(
  parseStoredView({ x: 0, y: 0, scale: Infinity }) == null,
  "scale is Infinity",
);
check(parseStoredView("{\"x\":1,\"y\":2,\"scale\":1}") == null, "raw string");
check(parseStoredView(null) == null, "null");
check(parseStoredView(undefined) == null, "undefined");
check(parseStoredView(1) == null, "number");
check(parseStoredView([1, 2, 3]) == null, "array");

console.log("viewMemory.test.ts ok");
