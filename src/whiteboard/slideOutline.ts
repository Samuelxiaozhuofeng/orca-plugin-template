import { slideAreas } from "./areaSlides.ts";
import { cardInArea, type WhiteboardArea } from "./areas.ts";

export type SlideOutlineRow = {
  areaId: string;
  index: number;
  number: number;
  name: string;
  cardCount: number;
};

/**
 * Computes the rows to display in the slideshow outline panel from areas and cards.
 * Folded areas count their contained cards normally.
 */
export function slideOutlineRows(
  areas: readonly WhiteboardArea[],
  cards: readonly { x: number; y: number; w: number; h: number }[],
): SlideOutlineRow[] {
  const slides = slideAreas(areas);
  return slides.map((area, index) => {
    let cardCount = 0;
    for (const card of cards) {
      if (cardInArea(card, area)) {
        cardCount += 1;
      }
    }
    return {
      areaId: area.id,
      index,
      number: index + 1,
      name: area.name,
      cardCount,
    };
  });
}
