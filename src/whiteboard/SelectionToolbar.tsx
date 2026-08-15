import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { COLOR_PRESETS } from "./CardToolbar";
import type { WhiteboardCard } from "./data";
import { selectedCards } from "./selection";
import type { UnifySizeMode } from "./cardBatch";

export function SelectionToolbar({
  cards,
  selectedIds,
  onColor,
  onUnifySize,
}: {
  cards: readonly WhiteboardCard[];
  selectedIds: readonly DbId[];
  onColor: (color: string | undefined) => void;
  onUnifySize: (mode: UnifySizeMode) => void;
}) {
  if (selectedIds.length < 2) return null;
  const picked = selectedCards(cards, new Set(selectedIds));
  const colors = new Set(picked.map((card) => card.color ?? "default"));
  const activeColor = colors.size === 1 ? [...colors][0] : null;

  return (
    <div
      className="owb-selection-bar"
      onMouseDown={(event: React.MouseEvent) => event.stopPropagation()}
    >
      <span className="owb-selection-bar-count">
        {t("${count} cards", { count: String(selectedIds.length) })}
      </span>
      <div className="owb-selection-bar-colors" role="group" aria-label={t("Card color")}>
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`owb-card-color-dot${
              activeColor === preset.id ? " is-active" : ""
            }`}
            style={{ backgroundColor: preset.bg }}
            title={t(preset.label)}
            onClick={() =>
              onColor(preset.id === "default" ? undefined : preset.id)
            }
          />
        ))}
      </div>
      <div className="owb-selection-bar-sep" />
      <button
        type="button"
        className="owb-selection-bar-btn"
        title={t("Match widest")}
        onClick={() => onUnifySize("widest")}
      >
        {t("Match widest")}
      </button>
      <button
        type="button"
        className="owb-selection-bar-btn"
        title={t("Match narrowest")}
        onClick={() => onUnifySize("narrowest")}
      >
        {t("Match narrowest")}
      </button>
    </div>
  );
}
