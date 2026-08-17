import { t } from "../libs/l10n";
import type { PresentCursor, Slide } from "./presentation";

type Props = {
  cursor: PresentCursor;
  slides: readonly Slide[];
  onExit: () => void;
};

export function PresentOverlay({ cursor, slides, onExit }: Props) {
  if (slides.length === 0) return null;
  const currentSlide = slides[cursor.slideIndex];
  const slideNum = cursor.slideIndex + 1;
  const slideTotal = slides.length;

  let label = `${slideNum} / ${slideTotal}`;
  if (cursor.cardIndex >= 0 && currentSlide) {
    const cardNum = cursor.cardIndex + 1;
    const cardTotal = currentSlide.cards.length;
    label += ` · ${t("Card ${i} of ${n}", {
      i: String(cardNum),
      n: String(cardTotal),
    })}`;
  }

  return (
    <div
      className="owb-present-overlay"
      onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      <span className="owb-present-label">{label}</span>
      <button
        type="button"
        className="owb-present-close"
        title={t("Exit slideshow")}
        aria-label={t("Exit slideshow")}
        onClick={onExit}
      >
        <i className="ti ti-x" />
      </button>
    </div>
  );
}
