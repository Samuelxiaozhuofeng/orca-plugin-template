import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  AlignTriggerIcon,
  ARRANGE_CELLS,
  WrapSectionIcon,
} from "./arrangeIcons";
import { COLOR_PRESETS } from "./CardToolbar";
import type { UnifySizeMode } from "./cardBatch";
import type { WhiteboardCard } from "./data";
import { selectedCards } from "./selection";
import type { ArrangeAction } from "./selection";
import { invokeCollectSelectedOnActivePanel } from "./collectIntoBoardApply";

const { useEffect, useRef, useState } = window.React;

function CollectBoardIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="1.5"
        y="2.5"
        width="8.5"
        height="6.2"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <rect
        x="6"
        y="7.3"
        width="8.5"
        height="6.2"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function stopBarMouseDown(event: { stopPropagation(): void }) {
  event.stopPropagation();
}

function ArrangePopover({
  selectedCount,
  onArrange,
}: {
  selectedCount: number;
  onArrange: (action: ArrangeAction) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      const root = wrapRef.current;
      if (root == null) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="owb-align-wrap">
      <button
        type="button"
        className={`owb-selection-icon${open ? " is-open" : ""}`}
        title={t("Arrange")}
        aria-label={t("Arrange")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((next: boolean) => !next)}
      >
        <AlignTriggerIcon />
      </button>
      {open ? (
        <div
          className="owb-align-pop"
          role="menu"
          aria-label={t("Arrange")}
          onMouseDown={stopBarMouseDown}
          onPointerDown={stopBarMouseDown}
        >
          <div className="owb-align-grid">
            {ARRANGE_CELLS.map((cell) => {
              const disabled = selectedCount < cell.min;
              return (
                <button
                  key={cell.action}
                  type="button"
                  className="owb-align-cell"
                  role="menuitem"
                  title={t(cell.title)}
                  aria-label={t(cell.title)}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    setOpen(false);
                    onArrange(cell.action);
                  }}
                >
                  <cell.Icon />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SelectionToolbar({
  cards,
  selectedIds,
  onColor,
  onUnifySize,
  onArrange,
  onWrapSelected,
}: {
  cards: readonly WhiteboardCard[];
  selectedIds: readonly DbId[];
  onColor: (color: string | undefined) => void;
  onUnifySize: (mode: UnifySizeMode) => void;
  onArrange: (action: ArrangeAction) => void;
  onWrapSelected: () => void;
}) {
  if (selectedIds.length < 2) return null;
  const picked = selectedCards(cards, new Set(selectedIds));
  const colors = new Set(picked.map((card) => card.color ?? "default"));
  const activeColor = colors.size === 1 ? [...colors][0] : null;

  return (
    <div className="owb-selection-bar" onMouseDown={stopBarMouseDown}>
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
      <div className="owb-selection-bar-sep" />
      <ArrangePopover selectedCount={selectedIds.length} onArrange={onArrange} />
      <button
        type="button"
        className="owb-selection-icon"
        title={t("Group into section")}
        aria-label={t("Group into section")}
        onClick={onWrapSelected}
      >
        <WrapSectionIcon />
      </button>
      <button
        type="button"
        className="owb-selection-icon"
        title={t("Collect into new whiteboard")}
        aria-label={t("Collect into new whiteboard")}
        onClick={invokeCollectSelectedOnActivePanel}
      >
        <CollectBoardIcon />
      </button>
    </div>
  );
}
