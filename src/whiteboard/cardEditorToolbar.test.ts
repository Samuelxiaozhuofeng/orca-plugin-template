import {
  placeEditorToolbar,
  placeEditorPopup,
  placeEditorFloating,
  viewportToCanvasLocal,
  canvasScaleFromMatrix,
  EDITOR_TOOLBAR_GAP,
  EDITOR_TOOLBAR_PAD,
  EDITOR_POPUP_GAP,
  EDITOR_POPUP_PAD,
} from "./cardEditorToolbar.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function near(a: number, b: number, message: string): void {
  check(Math.abs(a - b) < 0.001, `${message} (got ${a}, want ${b})`);
}

const viewport = { left: 0, top: 0, width: 800, height: 600 };
const toolbar = { width: 360, height: 44 };
const gap = EDITOR_TOOLBAR_GAP;
const pad = EDITOR_TOOLBAR_PAD;

const mid = placeEditorToolbar({
  selection: { x: 200, y: 300, width: 80, height: 18 },
  toolbar,
  viewport,
});
check(mid.side === "above", "room above → sit above the selection");
near(mid.top, 300 - gap - 44, "above: selection.y − gap − height");
near(mid.left, 200, "left-align to the selection");

const nearTop = placeEditorToolbar({
  selection: { x: 200, y: 20, width: 80, height: 18 },
  toolbar,
  viewport,
});
check(nearTop.side === "below", "too close to the top → flip below");
near(nearTop.top, 20 + 18 + gap, "below: selection bottom + gap");
near(nearTop.left, 200, "flip does not change left alignment");

const leftEdge = placeEditorToolbar({
  selection: { x: 4, y: 300, width: 40, height: 18 },
  toolbar,
  viewport,
});
near(leftEdge.left, pad, "clamp to the left padding");
check(leftEdge.side === "above", "left clamp still prefers above");

const rightEdge = placeEditorToolbar({
  selection: { x: 780, y: 300, width: 20, height: 18 },
  toolbar,
  viewport,
});
near(rightEdge.left, 800 - 360 - pad, "clamp to the right padding");

const offsetVp = { left: 100, top: 80, width: 800, height: 600 };
const offset = placeEditorToolbar({
  selection: { x: 90, y: 400, width: 40, height: 18 },
  toolbar,
  viewport: offsetVp,
});
near(offset.left, 108, "clamp uses the viewport origin, not 0");
check(offset.side === "above", "offset viewport still prefers above");

const offsetFlip = placeEditorToolbar({
  selection: { x: 300, y: 90, width: 40, height: 18 },
  toolbar,
  viewport: offsetVp,
});
check(offsetFlip.side === "below", "flip is relative to the viewport top");
near(offsetFlip.top, 90 + 18 + gap, "below uses the selection, not the viewport origin");

const tight = placeEditorToolbar({
  selection: { x: 10, y: 20, width: 20, height: 12 },
  toolbar: { width: 200, height: 40 },
  viewport: { left: 0, top: 0, width: 100, height: 80 },
  gap: 8,
  pad: 8,
});
near(tight.left, 8, "toolbar wider than the viewport pins to the left pad");
check(tight.side === "below", "no room above in a short viewport → below");
near(tight.top, 32, "below overflow clamps so the bar stays inside");

const tallSel = placeEditorToolbar({
  selection: { x: 200, y: 500, width: 80, height: 80 },
  toolbar,
  viewport,
});
check(tallSel.side === "above", "selection near the bottom still prefers above");
near(tallSel.top, 500 - gap - 44, "above the tall selection");

near(canvasScaleFromMatrix({ a: 1, b: 0 }), 1, "identity scale is 1");
near(canvasScaleFromMatrix({ a: 0.5, b: 0 }), 0.5, "translate+scale 50%");
near(canvasScaleFromMatrix({ a: 2, b: 0 }), 2, "translate+scale 200%");
near(canvasScaleFromMatrix({ a: 0, b: 0 }), 1, "degenerate matrix falls back to 1");

const local1 = viewportToCanvasLocal(250, 180, { left: 50, top: 80 }, 1);
near(local1.x, 200, "scale 1: subtract canvas origin x");
near(local1.y, 100, "scale 1: subtract canvas origin y");

const local2 = viewportToCanvasLocal(250, 180, { left: 50, top: 80 }, 2);
near(local2.x, 100, "scale 2: divide by scale x");
near(local2.y, 50, "scale 2: divide by scale y");

const localHalf = viewportToCanvasLocal(150, 100, { left: 50, top: 80 }, 0.5);
near(localHalf.x, 200, "scale 0.5: divide by scale x");
near(localHalf.y, 40, "scale 0.5: divide by scale y");

const localZero = viewportToCanvasLocal(150, 100, { left: 50, top: 80 }, 0);
near(localZero.x, 100, "scale 0 is treated as 1");
near(localZero.y, 20, "scale 0 is treated as 1 (y)");

const placed = placeEditorToolbar({
  selection: { x: 200, y: 300, width: 80, height: 18 },
  toolbar,
  viewport: { left: 40, top: 60, width: 800, height: 600 },
});
const onCanvas = viewportToCanvasLocal(
  placed.left,
  placed.top,
  { left: 40, top: 60 },
  2,
);
near(placed.left, 200, "place stays in viewport space");
near(onCanvas.x, (200 - 40) / 2, "placed left converts to canvas local");
near(onCanvas.y, (placed.top - 60) / 2, "placed top converts to canvas local");

// Popup tests (.orca-popup completion panel)
const popup = { width: 200, height: 180 };
const pGap = EDITOR_POPUP_GAP;
const pPad = EDITOR_POPUP_PAD;

const popupMid = placeEditorPopup({
  anchor: { x: 185, y: 164, width: 0, height: 20 },
  popup,
  viewport,
});
check(popupMid.side === "below", "popup prefers below the cursor");
near(popupMid.top, 164 + 20 + pGap, "below: cursor.y + cursor.height + pGap");
near(popupMid.left, 185, "left-align to the cursor caret");

const popupNearBottom = placeEditorPopup({
  anchor: { x: 185, y: 500, width: 0, height: 20 },
  popup,
  viewport,
});
check(popupNearBottom.side === "above", "too close to bottom → flip above cursor");
near(popupNearBottom.top, 500 - pGap - popup.height, "above: cursor.y − pGap − height");
near(popupNearBottom.left, 185, "flip does not change left alignment");

const popupLeftEdge = placeEditorPopup({
  anchor: { x: 2, y: 200, width: 0, height: 20 },
  popup,
  viewport,
});
near(popupLeftEdge.left, pPad, "clamp popup to left padding");

const popupRightEdge = placeEditorPopup({
  anchor: { x: 750, y: 200, width: 0, height: 20 },
  popup,
  viewport,
});
near(popupRightEdge.left, 800 - 200 - pPad, "clamp popup to right padding");

const popupOffsetVp = placeEditorPopup({
  anchor: { x: 90, y: 200, width: 0, height: 20 },
  popup,
  viewport: offsetVp,
});
near(popupOffsetVp.left, 100 + pPad, "clamp popup uses offset viewport origin");
near(popupOffsetVp.top, 200 + 20 + pGap, "popup top uses cursor in offset viewport");

const popupRealTrace = placeEditorPopup({
  anchor: { x: 185, y: 164, width: 0, height: 20 },
  popup: { width: 199, height: 167 },
  viewport: { left: 0, top: 0, width: 1200, height: 900 },
});
const popupRealCanvas = viewportToCanvasLocal(
  popupRealTrace.left,
  popupRealTrace.top,
  { left: -5043.44, top: 1414.5 },
  0.847821,
);
near(popupRealTrace.left, 185, "real trace viewport left matches caret");
near(popupRealTrace.top, 164 + 20 + pGap, "real trace viewport top sits below caret");
near(
  popupRealCanvas.x,
  (185 - -5043.44) / 0.847821,
  "real trace local x properly maps with zoom scale",
);
near(
  popupRealCanvas.y,
  (188 - 1414.5) / 0.847821,
  "real trace local y properly maps with zoom scale",
);

const genericAbove = placeEditorFloating({
  anchor: { x: 200, y: 300, width: 80, height: 18 },
  floating: toolbar,
  viewport,
  prefer: "above",
});
near(genericAbove.top, mid.top, "placeEditorFloating with prefer: above matches toolbar");

const genericBelow = placeEditorFloating({
  anchor: { x: 185, y: 164, width: 0, height: 20 },
  floating: popup,
  viewport,
  prefer: "below",
});
near(genericBelow.top, popupMid.top, "placeEditorFloating with prefer: below matches popup");
