import { type WhiteboardArea } from "./areas.ts";

/** Areas in the slideshow, by ascending `slide`; ties keep their array order. */
export function slideAreas(areas: readonly WhiteboardArea[]): WhiteboardArea[] {
  const result: WhiteboardArea[] = [];
  for (const area of areas) {
    if (area.slide != null) {
      result.push(area);
    }
  }
  return result.sort((a, b) => a.slide! - b.slide!);
}

/**
 * Re-numbers slide areas according to `orderedIds` to 1..n, and strips `slide` from any other area.
 * Returns null if the resulting array is identical to `areas`.
 */
function renumberSlides(
  areas: readonly WhiteboardArea[],
  orderedIds: readonly string[],
): WhiteboardArea[] | null {
  const orderMap = new Map<string, number>();
  for (let i = 0; i < orderedIds.length; i++) {
    orderMap.set(orderedIds[i], i + 1);
  }

  let changed = false;
  const nextAreas = areas.map((area) => {
    const targetSlide = orderMap.get(area.id);
    if (targetSlide != null) {
      if (area.slide === targetSlide) return area;
      changed = true;
      return { ...area, slide: targetSlide };
    }
    if (area.slide == null) return area;
    changed = true;
    const next = { ...area };
    delete next.slide;
    return next;
  });

  return changed ? nextAreas : null;
}

/** Append `id` to the end of the sequence. Null when it is already in it. */
export function planAddToSlides(
  areas: readonly WhiteboardArea[],
  id: string,
): WhiteboardArea[] | null {
  const target = areas.find((area) => area.id === id);
  if (target == null || target.slide != null) return null;
  const current = slideAreas(areas);
  const orderedIds = [...current.map((area) => area.id), id];
  return renumberSlides(areas, orderedIds);
}

/** Drop `id` from the sequence and renumber the rest. Null when it is not in it. */
export function planRemoveFromSlides(
  areas: readonly WhiteboardArea[],
  id: string,
): WhiteboardArea[] | null {
  const target = areas.find((area) => area.id === id);
  if (target == null || target.slide == null) return null;
  const current = slideAreas(areas);
  const orderedIds = current
    .filter((area) => area.id !== id)
    .map((area) => area.id);
  return renumberSlides(areas, orderedIds);
}

/** `delta` -1 moves one slide earlier, +1 later. Null at either end. */
export function planMoveSlide(
  areas: readonly WhiteboardArea[],
  id: string,
  delta: number,
): WhiteboardArea[] | null {
  if (delta === 0) return null;
  const target = areas.find((area) => area.id === id);
  if (target == null || target.slide == null) return null;
  const current = slideAreas(areas);
  const index = current.findIndex((area) => area.id === id);
  if (index === -1) return null;
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= current.length) return null;

  const reordered = [...current];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(nextIndex, 0, moved);

  return renumberSlides(
    areas,
    reordered.map((area) => area.id),
  );
}
