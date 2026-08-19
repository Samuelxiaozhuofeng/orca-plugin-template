import { CARD_TREE_OVERLAY_CLASS } from "./cardFitHeight.ts";

export const EDITOR_COVER_QUIET_FRAMES = 2;
export const EDITOR_COVER_MAX_MS = 600;

export type LiftEditorCoverInput = {
  editorLines: number;
  coveredLines: number;
  quietFrames: number;
  sawChange: boolean;
  elapsedMs?: number;
};

export function shouldLiftEditorCover(input: LiftEditorCoverInput): boolean {
  if (input.elapsedMs != null && input.elapsedMs >= EDITOR_COVER_MAX_MS) {
    return true;
  }
  if (input.coveredLines > 0 && input.editorLines >= input.coveredLines) {
    return true;
  }
  if (input.sawChange && input.quietFrames >= EDITOR_COVER_QUIET_FRAMES) {
    return true;
  }
  return false;
}

export function countCoveredLines(host: HTMLElement): number {
  const overlayTree = host
    .closest(".owb-card-body")
    ?.querySelector(`.owb-card-block-tree.${CARD_TREE_OVERLAY_CLASS}`);
  if (overlayTree == null) return 0;
  const nodes = overlayTree.querySelectorAll(".owb-card-block-node").length;
  if (nodes > 0) return nodes;
  return overlayTree.querySelectorAll(".orca-block").length;
}

export function countEditorLines(host: HTMLElement): number {
  return host.querySelectorAll(".orca-block").length;
}
