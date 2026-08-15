import {
  HOVER_PREVIEW_DELAY_MS,
  initialHoverPreviewState,
  stepHoverPreview,
} from "./hoverPreview.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

check(HOVER_PREVIEW_DELAY_MS >= 250, "delay is at least 250ms");
check(HOVER_PREVIEW_DELAY_MS <= 400, "delay is at most 400ms");

// 1. Stay past the delay → show.
{
  let result = stepHoverPreview(initialHoverPreviewState(), {
    type: "enter",
    blockId: 11,
    at: 0,
    gestureActive: false,
  });
  check(result.action === "none", "enter itself does not show");
  check(result.state.phase === "pending", "enter starts a pending dwell");
  result = stepHoverPreview(result.state, {
    type: "tick",
    at: HOVER_PREVIEW_DELAY_MS,
    gestureActive: false,
  });
  check(result.action === "show", "dwell past delay should show");
  check(result.state.phase === "shown", "phase is shown after a due tick");
  check(result.state.blockId === 11, "shown preview is the hovered block");
}

// 2. Leave before the delay → do not show, including a late tick.
{
  let result = stepHoverPreview(initialHoverPreviewState(), {
    type: "enter",
    blockId: 22,
    at: 0,
    gestureActive: false,
  });
  result = stepHoverPreview(result.state, { type: "leave", at: 80 });
  check(result.action === "none", "leave before show does not hide (nothing open)");
  check(result.state.phase === "idle", "leave before delay returns to idle");
  result = stepHoverPreview(result.state, {
    type: "tick",
    at: HOVER_PREVIEW_DELAY_MS,
    gestureActive: false,
  });
  check(result.action === "none", "late tick after leave must not show");
  check(result.state.phase === "idle", "late tick stays idle");
}

// 3. Already shown, then leave → hide.
{
  let result = stepHoverPreview(initialHoverPreviewState(), {
    type: "enter",
    blockId: 33,
    at: 1_000,
    gestureActive: false,
  });
  result = stepHoverPreview(result.state, {
    type: "tick",
    at: 1_000 + HOVER_PREVIEW_DELAY_MS,
    gestureActive: false,
  });
  check(result.action === "show", "setup: preview is open");
  result = stepHoverPreview(result.state, { type: "leave", at: 2_000 });
  check(result.action === "hide", "leave after show should hide");
  check(result.state.phase === "idle", "hide returns to idle");
}

// 4. Gesture in progress (drag / marquee / edge-draw) → never show.
{
  let result = stepHoverPreview(initialHoverPreviewState(), {
    type: "enter",
    blockId: 44,
    at: 0,
    gestureActive: true,
  });
  check(result.action === "none", "enter during a gesture does not show");
  check(result.state.phase === "idle", "enter during a gesture stays idle");
  result = stepHoverPreview(result.state, {
    type: "tick",
    at: HOVER_PREVIEW_DELAY_MS,
    gestureActive: true,
  });
  check(result.action === "none", "tick while idle+gesture does not show");

  result = stepHoverPreview(initialHoverPreviewState(), {
    type: "enter",
    blockId: 45,
    at: 0,
    gestureActive: false,
  });
  result = stepHoverPreview(result.state, {
    type: "tick",
    at: HOVER_PREVIEW_DELAY_MS,
    gestureActive: true,
  });
  check(
    result.action === "none",
    "due tick during a gesture must not show",
  );
  check(result.state.phase === "idle", "due tick during a gesture cancels");

  result = stepHoverPreview(initialHoverPreviewState(), {
    type: "enter",
    blockId: 46,
    at: 0,
    gestureActive: false,
  });
  result = stepHoverPreview(result.state, { type: "gesture", at: 40 });
  check(result.state.phase === "idle", "pointer-down cancels a pending dwell");
  result = stepHoverPreview(result.state, {
    type: "tick",
    at: HOVER_PREVIEW_DELAY_MS,
    gestureActive: false,
  });
  check(result.action === "none", "tick after gesture cancel must not show");
}

// Sweeping across rows must not leave a trail: new enter hides the old preview.
{
  let result = stepHoverPreview(initialHoverPreviewState(), {
    type: "enter",
    blockId: 51,
    at: 0,
    gestureActive: false,
  });
  result = stepHoverPreview(result.state, {
    type: "tick",
    at: HOVER_PREVIEW_DELAY_MS,
    gestureActive: false,
  });
  result = stepHoverPreview(result.state, {
    type: "enter",
    blockId: 52,
    at: HOVER_PREVIEW_DELAY_MS + 10,
    gestureActive: false,
  });
  check(result.action === "hide", "moving to another row hides the open preview");
  check(result.state.phase === "pending", "new row starts its own dwell");
  check(result.state.blockId === 52, "pending target is the new row");
}

console.log("hoverPreview.test.ts ok");
