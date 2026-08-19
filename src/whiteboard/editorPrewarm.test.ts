import {
  PREWARM_DISCARD_GRACE_MS,
  PREWARM_HOVER_DELAY_MS,
  initialEditorPrewarmState,
  prewarmedCardId,
  stepEditorPrewarm,
} from "./editorPrewarm.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

// 12. Constants
check(PREWARM_HOVER_DELAY_MS === 250, "hover delay constant is 250ms");
check(PREWARM_DISCARD_GRACE_MS === 200, "grace delay constant is 200ms");

const defaultGates = {
  enabled: true,
  anyEditing: false,
  gestureActive: false,
};

// 1. enter itself does not enter ready
{
  const state = stepEditorPrewarm(initialEditorPrewarmState(), {
    type: "enter",
    cardId: 101,
    at: 1000,
    ...defaultGates,
  });
  check(state.phase === "pending", "enter starts pending phase");
  check(state.cardId === 101, "pending cardId matches entered card");
  check(state.since === 1000, "since timestamp matches enter at");
  check(prewarmedCardId(state) === null, "enter itself does not prewarm card");
}

// 2. enter + tick < 250ms -> still pending, prewarmedCardId is null
{
  let state = stepEditorPrewarm(initialEditorPrewarmState(), {
    type: "enter",
    cardId: 102,
    at: 1000,
    ...defaultGates,
  });
  state = stepEditorPrewarm(state, {
    type: "tick",
    at: 1249,
    ...defaultGates,
  });
  check(state.phase === "pending", "tick before 250ms remains pending");
  check(state.cardId === 102, "cardId preserved in pending");
  check(prewarmedCardId(state) === null, "prewarmedCardId is null before 250ms");
}

// 3. enter + tick == 250ms -> ready, id correct
{
  let state = stepEditorPrewarm(initialEditorPrewarmState(), {
    type: "enter",
    cardId: 103,
    at: 1000,
    ...defaultGates,
  });
  state = stepEditorPrewarm(state, {
    type: "tick",
    at: 1250,
    ...defaultGates,
  });
  check(state.phase === "ready", "tick at 250ms reaches ready");
  check(state.cardId === 103, "ready cardId is correct");
  check(prewarmedCardId(state) === 103, "prewarmedCardId returns ready cardId");
}

// 4. Quick sweep: enter then immediate leave -> idle, late tick does not turn ready
{
  let state = stepEditorPrewarm(initialEditorPrewarmState(), {
    type: "enter",
    cardId: 104,
    at: 1000,
    ...defaultGates,
  });
  state = stepEditorPrewarm(state, {
    type: "leave",
    at: 1050,
  });
  check(state.phase === "idle", "leave from pending goes directly to idle");
  check(state.cardId === null, "cardId cleared on quick leave");
  check(prewarmedCardId(state) === null, "prewarmedCardId is null on idle");

  state = stepEditorPrewarm(state, {
    type: "tick",
    at: 1300,
    ...defaultGates,
  });
  check(state.phase === "idle", "late tick after leave stays idle");
  check(prewarmedCardId(state) === null, "late tick does not produce prewarmed card");
}

// 5. ready then leave -> within 200ms grace, state is leaving and prewarmedCardId is still that card
{
  let state = stepEditorPrewarm(initialEditorPrewarmState(), {
    type: "enter",
    cardId: 105,
    at: 1000,
    ...defaultGates,
  });
  state = stepEditorPrewarm(state, {
    type: "tick",
    at: 1250,
    ...defaultGates,
  });
  check(state.phase === "ready", "setup: reached ready");

  state = stepEditorPrewarm(state, {
    type: "leave",
    at: 2000,
  });
  check(state.phase === "leaving", "leave from ready transitions to leaving");
  check(state.cardId === 105, "leaving retains cardId");
  check(state.since === 2000, "leaving updates since to leave timestamp");
  check(prewarmedCardId(state) === 105, "prewarmedCardId remains active during grace period");

  state = stepEditorPrewarm(state, {
    type: "tick",
    at: 2199,
    ...defaultGates,
  });
  check(state.phase === "leaving", "tick at 199ms grace remains leaving");
  check(prewarmedCardId(state) === 105, "prewarmedCardId still active at 199ms grace");
}

// 6. leave then tick >= 200ms -> idle
{
  let state = stepEditorPrewarm(initialEditorPrewarmState(), {
    type: "enter",
    cardId: 106,
    at: 1000,
    ...defaultGates,
  });
  state = stepEditorPrewarm(state, {
    type: "tick",
    at: 1250,
    ...defaultGates,
  });
  state = stepEditorPrewarm(state, {
    type: "leave",
    at: 2000,
  });
  state = stepEditorPrewarm(state, {
    type: "tick",
    at: 2200,
    ...defaultGates,
  });
  check(state.phase === "idle", "tick at 200ms grace transitions leaving to idle");
  check(state.cardId === null, "cardId cleared after grace period");
  check(prewarmedCardId(state) === null, "prewarmedCardId is null after grace expiry");
}

// 7. Re-enter same card within leave grace -> returns to ready (uninterrupted mount)
{
  let state = stepEditorPrewarm(initialEditorPrewarmState(), {
    type: "enter",
    cardId: 107,
    at: 1000,
    ...defaultGates,
  });
  state = stepEditorPrewarm(state, {
    type: "tick",
    at: 1250,
    ...defaultGates,
  });
  state = stepEditorPrewarm(state, {
    type: "leave",
    at: 2000,
  });
  check(state.phase === "leaving", "is leaving");

  state = stepEditorPrewarm(state, {
    type: "enter",
    cardId: 107,
    at: 2100,
    ...defaultGates,
  });
  check(state.phase === "ready", "re-enter same card restores ready phase");
  check(state.cardId === 107, "cardId stays 107");
  check(prewarmedCardId(state) === 107, "prewarmedCardId stays 107");
}

// 8. When ready, enter another card -> pending new card, prewarmedCardId is null
{
  let state = stepEditorPrewarm(initialEditorPrewarmState(), {
    type: "enter",
    cardId: 108,
    at: 1000,
    ...defaultGates,
  });
  state = stepEditorPrewarm(state, {
    type: "tick",
    at: 1250,
    ...defaultGates,
  });
  check(prewarmedCardId(state) === 108, "card 108 ready");

  state = stepEditorPrewarm(state, {
    type: "enter",
    cardId: 208,
    at: 2000,
    ...defaultGates,
  });
  check(state.phase === "pending", "enter new card sets phase to pending");
  check(state.cardId === 208, "state cardId switched to new card");
  check(state.since === 2000, "since set to new enter timestamp");
  check(prewarmedCardId(state) === null, "prewarmedCardId becomes null immediately upon entering new card");
}

// 9. enter with anyEditing / gestureActive / !enabled -> idle
{
  let state = stepEditorPrewarm(initialEditorPrewarmState(), {
    type: "enter",
    cardId: 109,
    at: 1000,
    enabled: false,
    anyEditing: false,
    gestureActive: false,
  });
  check(state.phase === "idle", "enter when disabled is idle");
  check(prewarmedCardId(state) === null, "prewarmedCardId is null");

  state = stepEditorPrewarm(initialEditorPrewarmState(), {
    type: "enter",
    cardId: 109,
    at: 1000,
    enabled: true,
    anyEditing: true,
    gestureActive: false,
  });
  check(state.phase === "idle", "enter when anyEditing is idle");

  state = stepEditorPrewarm(initialEditorPrewarmState(), {
    type: "enter",
    cardId: 109,
    at: 1000,
    enabled: true,
    anyEditing: false,
    gestureActive: true,
  });
  check(state.phase === "idle", "enter when gestureActive is idle");
}

// 10. pending / ready / leaving with tick with anyEditing / gestureActive / !enabled -> idle
{
  // pending -> tick disabled
  let state = stepEditorPrewarm(initialEditorPrewarmState(), {
    type: "enter",
    cardId: 110,
    at: 1000,
    ...defaultGates,
  });
  let next = stepEditorPrewarm(state, {
    type: "tick",
    at: 1100,
    enabled: false,
    anyEditing: false,
    gestureActive: false,
  });
  check(next.phase === "idle", "pending tick disabled becomes idle");

  // ready -> tick anyEditing
  state = stepEditorPrewarm(initialEditorPrewarmState(), {
    type: "enter",
    cardId: 110,
    at: 1000,
    ...defaultGates,
  });
  state = stepEditorPrewarm(state, {
    type: "tick",
    at: 1250,
    ...defaultGates,
  });
  check(state.phase === "ready", "setup ready");
  next = stepEditorPrewarm(state, {
    type: "tick",
    at: 1300,
    enabled: true,
    anyEditing: true,
    gestureActive: false,
  });
  check(next.phase === "idle", "ready tick anyEditing becomes idle");
  check(prewarmedCardId(next) === null, "prewarmedCardId dropped");

  // leaving -> tick gestureActive
  state = stepEditorPrewarm(state, {
    type: "leave",
    at: 1400,
  });
  check(state.phase === "leaving", "setup leaving");
  next = stepEditorPrewarm(state, {
    type: "tick",
    at: 1450,
    enabled: true,
    anyEditing: false,
    gestureActive: true,
  });
  check(next.phase === "idle", "leaving tick gestureActive becomes idle");
}

// 11. block / reset clears ready / pending / leaving
{
  let state = stepEditorPrewarm(initialEditorPrewarmState(), {
    type: "enter",
    cardId: 111,
    at: 1000,
    ...defaultGates,
  });
  state = stepEditorPrewarm(state, {
    type: "tick",
    at: 1250,
    ...defaultGates,
  });
  check(state.phase === "ready", "setup ready");

  let blocked = stepEditorPrewarm(state, { type: "block" });
  check(blocked.phase === "idle" && blocked.cardId === null, "block clears ready to idle");
  check(prewarmedCardId(blocked) === null, "prewarmedCardId null after block");

  let reset = stepEditorPrewarm(state, { type: "reset" });
  check(reset.phase === "idle" && reset.cardId === null, "reset clears ready to idle");
  check(prewarmedCardId(reset) === null, "prewarmedCardId null after reset");
}

console.log("editorPrewarm.test.ts ok");
