import type { ControlsMode } from "./controlsMode";

export type CardPointerZone = "header" | "body" | "other";

export type CardPointerRoute =
  | { kind: "pan" }
  | { kind: "ignore" }
  | { kind: "rightCard" }
  | { kind: "moveCard"; enterEditOnClick: boolean }
  | { kind: "textSelect" };

const HEADER_ZONE = ".owb-card-header, .owb-card-journal-badge";

/** Where a press landed on a card: title chrome, note body, or the rest. */
export function cardPointerZone(target: EventTarget | null): CardPointerZone {
  if (!(target instanceof Element)) return "other";
  if (target.closest(HEADER_ZONE) != null) return "header";
  if (target.closest(".owb-card-body") != null) return "body";
  return "other";
}

export type CardPointerInput = {
  button: number;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  spaceHeld: boolean;
  controlsMode: ControlsMode;
  editing: boolean;
  zone: CardPointerZone;
};

/**
 * Decides what a press on a card should do. Modifier keys are accepted so
 * callers can pass the full event; they do not change the route (additive
 * select and click-to-edit still filter them later).
 */
export function routeCardPointer(input: CardPointerInput): CardPointerRoute {
  if (input.button === 1 || input.spaceHeld) return { kind: "pan" };
  if (input.button === 2) {
    return input.controlsMode === "mouse"
      ? { kind: "rightCard" }
      : { kind: "ignore" };
  }
  if (input.button !== 0) return { kind: "ignore" };
  if (input.editing && input.zone === "body") return { kind: "ignore" };
  if (input.controlsMode === "trackpad") {
    return { kind: "moveCard", enterEditOnClick: true };
  }
  if (input.zone === "body") return { kind: "textSelect" };
  return { kind: "moveCard", enterEditOnClick: false };
}
