import type { DbId } from "../orca.d.ts";

export const PREWARM_HOVER_DELAY_MS = 250;
export const PREWARM_DISCARD_GRACE_MS = 200;

export type EditorPrewarmPhase = "idle" | "pending" | "ready" | "leaving";

export type EditorPrewarmState = {
  phase: EditorPrewarmPhase;
  cardId: DbId | null;
  since: number;
};

export type EditorPrewarmGates = {
  enabled: boolean;
  anyEditing: boolean;
  gestureActive: boolean;
};

export type EditorPrewarmEvent =
  | ({ type: "enter"; cardId: DbId; at: number } & EditorPrewarmGates)
  | { type: "leave"; at: number }
  | ({ type: "tick"; at: number } & EditorPrewarmGates)
  | { type: "block" }
  | { type: "reset" };

export function initialEditorPrewarmState(): EditorPrewarmState {
  return { phase: "idle", cardId: null, since: 0 };
}

/** Returns cardId when ready or in leaving grace period, otherwise null. */
export function prewarmedCardId(state: EditorPrewarmState): DbId | null {
  if (state.phase === "ready" || state.phase === "leaving") {
    return state.cardId;
  }
  return null;
}

export function stepEditorPrewarm(
  state: EditorPrewarmState,
  event: EditorPrewarmEvent,
  delays?: { hoverMs?: number; graceMs?: number },
): EditorPrewarmState {
  const hoverMs = delays?.hoverMs ?? PREWARM_HOVER_DELAY_MS;
  const graceMs = delays?.graceMs ?? PREWARM_DISCARD_GRACE_MS;

  if (event.type === "block" || event.type === "reset") {
    return initialEditorPrewarmState();
  }

  if (event.type === "enter") {
    if (!event.enabled || event.anyEditing || event.gestureActive) {
      return initialEditorPrewarmState();
    }
    if (
      (state.phase === "ready" || state.phase === "leaving") &&
      state.cardId === event.cardId
    ) {
      return { phase: "ready", cardId: event.cardId, since: state.since };
    }
    if (state.phase === "pending" && state.cardId === event.cardId) {
      return state;
    }
    return {
      phase: "pending",
      cardId: event.cardId,
      since: event.at,
    };
  }

  if (event.type === "leave") {
    if (state.phase === "ready" || state.phase === "leaving") {
      return {
        phase: "leaving",
        cardId: state.cardId,
        since: event.at,
      };
    }
    return initialEditorPrewarmState();
  }

  if (event.type === "tick") {
    if (!event.enabled || event.anyEditing || event.gestureActive) {
      return initialEditorPrewarmState();
    }
    if (state.phase === "pending" && state.cardId != null) {
      if (event.at - state.since >= hoverMs) {
        return {
          phase: "ready",
          cardId: state.cardId,
          since: state.since,
        };
      }
      return state;
    }
    if (state.phase === "leaving" && state.cardId != null) {
      if (event.at - state.since >= graceMs) {
        return initialEditorPrewarmState();
      }
      return state;
    }
    return state;
  }

  return state;
}
