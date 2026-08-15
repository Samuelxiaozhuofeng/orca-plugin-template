import {
  nextEdgeToolbarOpen,
  placeEdgeToolbar,
  type EdgeToolbarSignal,
} from "./edgeToolbarLayout.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function near(a: number, b: number, message: string): void {
  check(Math.abs(a - b) < 0.001, `${message} (got ${a}, want ${b})`);
}

const viewport = { left: 0, top: 0, width: 800, height: 600 };
const box = { toolbarWidth: 200, toolbarHeight: 40, gap: 48, pad: 8 };

const mid = placeEdgeToolbar({
  clickX: 400,
  clickY: 300,
  viewport,
  ...box,
});
check(mid.side === "above", "room above → sit above the click");
near(mid.top, 300 - 48 - 40, "above: clickY − gap − height");
near(mid.left, 300, "centred on the click horizontally");

const nearTop = placeEdgeToolbar({
  clickX: 400,
  clickY: 50,
  viewport,
  ...box,
});
check(nearTop.side === "below", "too close to the top → flip below");
near(nearTop.top, 50 + 48, "below: clickY + gap");
near(nearTop.left, 300, "flip does not change horizontal centering");

const leftEdge = placeEdgeToolbar({
  clickX: 20,
  clickY: 300,
  viewport,
  ...box,
});
near(leftEdge.left, 8, "clamp to the left padding");
check(leftEdge.side === "above", "left clamp still prefers above");

const rightEdge = placeEdgeToolbar({
  clickX: 790,
  clickY: 300,
  viewport,
  ...box,
});
near(rightEdge.left, 800 - 200 - 8, "clamp to the right padding");

const offsetVp = { left: 100, top: 80, width: 800, height: 600 };
const offset = placeEdgeToolbar({
  clickX: 120,
  clickY: 400,
  viewport: offsetVp,
  ...box,
});
near(offset.left, 108, "clamp uses the viewport origin, not 0");
check(offset.side === "above", "offset viewport still prefers above");

const offsetFlip = placeEdgeToolbar({
  clickX: 500,
  clickY: 90,
  viewport: offsetVp,
  ...box,
});
check(offsetFlip.side === "below", "flip is relative to the viewport top");
near(offsetFlip.top, 90 + 48, "below uses the click, not the viewport origin");

const tight = placeEdgeToolbar({
  clickX: 50,
  clickY: 40,
  viewport: { left: 0, top: 0, width: 100, height: 80 },
  toolbarWidth: 200,
  toolbarHeight: 40,
  gap: 48,
  pad: 8,
});
near(tight.left, 8, "toolbar wider than the viewport pins to the left pad");
check(tight.side === "below", "no room above in a short viewport → below");
near(tight.top, 32, "below overflow clamps so the bar stays inside");

function open(signal: EdgeToolbarSignal): boolean {
  return nextEdgeToolbarOpen(signal);
}

check(
  open({ kind: "select", prevId: null, nextId: "a" }) === true,
  "first select of a line opens the bar",
);
check(
  open({ kind: "select", prevId: "a", nextId: "b" }) === true,
  "selecting a different line opens the bar",
);
check(
  open({ kind: "select", prevId: "a", nextId: "a" }) === false,
  "pressing the already-selected line does not reopen",
);
check(
  open({ kind: "select", prevId: "a", nextId: null }) === false,
  "clearing the selection hides the bar",
);
check(
  open({ kind: "select", prevId: null, nextId: null }) === false,
  "empty select stays closed",
);

const hideCauses: EdgeToolbarSignal[] = [
  { kind: "edge-press" },
  { kind: "escape" },
  { kind: "view-change" },
  { kind: "marquee-start" },
  { kind: "pan-start" },
  { kind: "card-drag-start" },
  { kind: "card-edit" },
  { kind: "panel-blur" },
];
for (const signal of hideCauses) {
  check(open(signal) === false, `${signal.kind} hides the bar`);
}

check(
  open({ kind: "toolbar-press" }) === true,
  "pressing the toolbar itself keeps it open",
);
