import type { DbId } from "../orca.d.ts";
import type { WhiteboardArea } from "./areas.ts";
import type { PresentationState } from "./usePresentation.ts";
import { resolveResumeSlide } from "./presentation.ts";
import { getRememberedPresentation } from "./presentationMemory.ts";

/**
 * Derives the subset of areas visible during presentation (only current slide's area).
 */
export function derivePresentationAreas(
  areas: readonly WhiteboardArea[],
  presenting: boolean,
  presentation?: PresentationState,
): readonly WhiteboardArea[] {
  if (!presenting || !presentation) return areas;
  const curSlide = presentation.slides[presentation.cursor.slideIndex];
  if (!curSlide) return [];
  return areas.filter((a) => a.id === curSlide.areaId);
}

/**
 * Derives the 1-based slide number for resuming last presentation if valid.
 */
export function deriveResumeSlideNumber(
  boardBlockId: DbId,
  presentation?: PresentationState,
): number | null {
  if (!presentation?.slides) return null;
  const saved = getRememberedPresentation(boardBlockId);
  return resolveResumeSlide(presentation.slides, saved)?.slideNumber ?? null;
}
