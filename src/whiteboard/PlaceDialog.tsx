import { t } from "../libs/l10n";
import {
  MAX_GRID_COLUMNS,
  MAX_RANGE_DAYS,
  MIN_GRID_COLUMNS,
  clampGridColumns,
  formatDateKey,
  inclusiveDayCount,
  matchingPreset,
  normalizeRange,
  rangeFromPreset,
  startOfLocalDay,
  type DateRange,
  type LayoutMode,
  type RangePreset,
} from "./layout";

const { useEffect, useRef, useState } = window.React;

export type PlaceDialogValue = {
  start: Date;
  end: Date;
  layout: LayoutMode;
  columns: number;
  onlyWithContent: boolean;
};

type Props = {
  visible: boolean;
  defaultColumns: number;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (value: PlaceDialogValue) => void;
};

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: "thisWeek", label: "This week" },
  { id: "lastWeek", label: "Last week" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
];

const COLUMN_OPTIONS = Array.from({ length: MAX_GRID_COLUMNS }, (_, i) => ({
  value: String(i + MIN_GRID_COLUMNS),
  label: String(i + MIN_GRID_COLUMNS),
}));

function DateField({
  value,
  onChange,
  disabled,
  menuContainer,
}: {
  value: Date;
  onChange: (date: Date) => void;
  disabled: boolean;
  menuContainer: React.RefObject<HTMLElement>;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        ref={ref}
        type="button"
        className="owb-date-btn"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {formatDateKey(value)}
      </button>
      {open ? (
        <orca.components.DatePicker
          mode="date"
          value={value}
          visible
          menuContainer={menuContainer}
          refElement={ref as unknown as React.RefObject<HTMLElement>}
          onChange={(next) => {
            const raw = Array.isArray(next) ? next[0] : next;
            onChange(startOfLocalDay(raw));
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function PlaceDialog({
  visible,
  defaultColumns,
  submitting,
  onClose,
  onConfirm,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset("thisWeek"));
  const [layout, setLayout] = useState<LayoutMode>("calendar");
  const [columns, setColumns] = useState(defaultColumns);
  const [onlyWithContent, setOnlyWithContent] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setRange(rangeFromPreset("thisWeek"));
    setLayout("calendar");
    setColumns(defaultColumns);
    setOnlyWithContent(true);
  }, [visible, defaultColumns]);

  const days = inclusiveDayCount(range.start, range.end);
  const overLimit = days > MAX_RANGE_DAYS;
  const activePreset = matchingPreset(range);

  const applyRange = (start: Date, end: Date) => {
    setRange(normalizeRange(start, end));
  };

  return (
    <orca.components.ModalOverlay
      visible={visible}
      blurred
      canClose={!submitting}
      onClose={onClose}
    >
      <div
        ref={dialogRef}
        className="owb-dialog"
        role="dialog"
        aria-labelledby="owb-place-title"
      >
        <div id="owb-place-title" className="owb-dialog-title">
          {t("Place journals")}
        </div>

        <div className="owb-dialog-section">
          <div className="owb-dialog-label">{t("Date range")}</div>
          <div className="owb-preset-row">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`owb-preset${activePreset === preset.id ? " is-active" : ""}`}
                disabled={submitting}
                onClick={() => setRange(rangeFromPreset(preset.id))}
              >
                {t(preset.label)}
              </button>
            ))}
          </div>
          <div className="owb-date-row">
            <DateField
              value={range.start}
              disabled={submitting}
              menuContainer={dialogRef as unknown as React.RefObject<HTMLElement>}
              onChange={(start) => applyRange(start, range.end)}
            />
            <span className="owb-date-sep">–</span>
            <DateField
              value={range.end}
              disabled={submitting}
              menuContainer={dialogRef as unknown as React.RefObject<HTMLElement>}
              onChange={(end) => applyRange(range.start, end)}
            />
            <span className="owb-date-count">
              {t("${count} days", { count: String(days) })}
            </span>
          </div>
          {overLimit ? (
            <div className="owb-dialog-warn">
              {t("Range is limited to 92 days")}
            </div>
          ) : null}
        </div>

        <div className="owb-dialog-section">
          <div className="owb-dialog-label">{t("Layout")}</div>
          <orca.components.Segmented
            selected={layout}
            options={[
              { value: "calendar", label: t("Calendar layout") },
              { value: "grid", label: t("Grid layout") },
            ]}
            onChange={(value) => {
              if (submitting) return;
              if (value === "calendar" || value === "grid") setLayout(value);
            }}
          />
          {layout === "calendar" ? (
            <div className="owb-dialog-hint">
              {t("Empty days keep their calendar slots.")}
            </div>
          ) : (
            <div className="owb-columns-row">
              <span className="owb-dialog-hint">{t("Columns per row")}</span>
              <orca.components.Select
                selected={[String(columns)]}
                options={COLUMN_OPTIONS}
                width={72}
                disabled={submitting}
                onChange={(selected) => {
                  const next = Number(selected[0]);
                  if (Number.isFinite(next)) setColumns(clampGridColumns(next));
                }}
              />
            </div>
          )}
        </div>

        <label className="owb-check-row">
          <orca.components.Checkbox
            checked={onlyWithContent}
            disabled={submitting}
            onChange={({ checked }) => setOnlyWithContent(checked)}
          />
          <span>{t("Only journals with content")}</span>
        </label>

        <div className="owb-dialog-actions">
          <orca.components.Button
            variant="outline"
            disabled={submitting}
            onClick={onClose}
          >
            {t("Cancel")}
          </orca.components.Button>
          <orca.components.Button
            variant="solid"
            disabled={submitting || overLimit}
            onClick={() =>
              onConfirm({
                start: range.start,
                end: range.end,
                layout,
                columns,
                onlyWithContent,
              })
            }
          >
            {submitting ? t("Placing…") : t("Place")}
          </orca.components.Button>
        </div>
      </div>
    </orca.components.ModalOverlay>
  );
}
