import { MIN_SCALE } from "./layout.ts";
import { contentBounds, fitViewForBoxes, type FitBox } from "./fitView.ts";

function check(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function near(a: number, b: number, msg: string): void {
  check(Math.abs(a - b) < 0.001, `${msg} (got ${a}, want ${b})`);
}

function box(x: number, y: number, w = 100, h = 100): FitBox {
  return { x, y, w, h };
}

check(contentBounds([]) == null, "no boxes means no bounds");

const bounds = contentBounds([box(0, 0), box(300, 200, 50, 50)]);
check(bounds != null, "bounds exist");
near(bounds!.x, 0, "bounds left");
near(bounds!.y, 0, "bounds top");
near(bounds!.w, 350, "bounds width");
near(bounds!.h, 250, "bounds height");

check(
  fitViewForBoxes([box(0, 0)], { width: 0, height: 0 }) == null,
  "unmeasured viewport cannot be fitted",
);
check(fitViewForBoxes([], { width: 800, height: 600 }) == null, "empty board");

// Content much smaller than the viewport: centre it, do not zoom past 100%.
const small = fitViewForBoxes([box(0, 0, 100, 100)], { width: 800, height: 600 });
check(small != null, "small content fits");
near(small!.scale, 1, "small content stays at 100%");
near(small!.x, 800 / 2 - 50, "small content centred horizontally");
near(small!.y, 600 / 2 - 50, "small content centred vertically");

// Content wider than the viewport: zoom out enough to clear the padding.
const wide = fitViewForBoxes([box(0, 0, 2000, 100)], {
  width: 800,
  height: 600,
});
check(wide != null, "wide content fits");
near(wide!.scale, (800 - 96) / 2000, "wide content zooms out to the padding");
near(wide!.x, 400 - 1000 * wide!.scale, "wide content centred horizontally");

// Far-flung content still resolves to a view rather than a broken scale.
const sparse = fitViewForBoxes([box(0, 0), box(100000, 100000)], {
  width: 800,
  height: 600,
});
check(sparse != null, "sparse content fits");
near(sparse!.scale, MIN_SCALE, "sparse content clamps to the minimum scale");

// A degenerate single point has no extent; it should centre at 100%.
const point = fitViewForBoxes([box(40, 40, 0, 0)], { width: 800, height: 600 });
check(point != null, "zero-size box still fits");
near(point!.scale, 1, "zero-size box stays at 100%");
near(point!.x, 400 - 40, "zero-size box centred horizontally");

console.log("fitView tests passed");
