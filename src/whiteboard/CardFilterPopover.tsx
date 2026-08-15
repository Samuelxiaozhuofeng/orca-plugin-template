import { t } from "../libs/l10n";
import { normalizeTagName } from "./cardFilter";
import type { useCardFilterControls } from "./useCardFilter";

const { useEffect, useRef } = window.React;

type Controls = ReturnType<typeof useCardFilterControls>;

export function CardFilterPopover({
  controls,
}: {
  controls: Controls;
}): React.ReactNode {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { tagSearch, tagHits, tags, searching, toggleTag, setTagSearch } =
    controls;
  const selected = new Set(
    tags.map((name: string) => normalizeTagName(name).toLowerCase()),
  );

  useEffect(() => {
    const el = inputRef.current;
    if (el == null) return;
    el.focus();
    const timer = window.setTimeout(() => el.focus(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      controls.setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [controls]);

  return (
    <div
      className="owb-card-filter"
      role="dialog"
      aria-label={t("Filter cards")}
      onMouseDown={(event: React.MouseEvent) => event.stopPropagation()}
      onKeyDown={(event: React.KeyboardEvent) => event.stopPropagation()}
    >
      <input
        ref={inputRef}
        className="owb-card-filter-input"
        type="search"
        value={tagSearch}
        autoFocus
        placeholder={t("Type a tag name")}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          setTagSearch(event.target.value)
        }
        onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          const first = tagHits[0];
          if (first != null) toggleTag(first);
        }}
      />
      {tagSearch.trim() === "" && tags.length === 0 ? (
        <div className="owb-card-filter-hint">
          {t("Pick tags to highlight matching cards on this board.")}
        </div>
      ) : tagHits.length === 0 && !searching ? (
        <div className="owb-card-filter-hint">{t("No matching tags")}</div>
      ) : (
        <div className="owb-card-filter-list" role="listbox">
          {tagHits.map((name: string) => {
            const on = selected.has(normalizeTagName(name).toLowerCase());
            return (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={on}
                className={`owb-card-filter-item${on ? " is-on" : ""}`}
                onMouseDown={(event: React.MouseEvent) => event.preventDefault()}
                onClick={() => toggleTag(name)}
              >
                <span className="owb-card-filter-check" aria-hidden="true">
                  {on ? "✓" : ""}
                </span>
                <span className="owb-card-filter-name">#{name}</span>
              </button>
            );
          })}
          {searching ? (
            <div className="owb-card-filter-hint">{t("Searching…")}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function CardFilterBanner({
  tags,
  matched,
  total,
  belowSearch,
  onClear,
}: {
  tags: readonly string[];
  matched: number;
  total: number;
  belowSearch?: boolean;
  onClear: () => void;
}): React.ReactNode {
  const labels = tags
    .map((name) => normalizeTagName(name))
    .filter((name) => name !== "")
    .map((name) => `#${name}`);
  return (
    <div
      className={`owb-filter-banner${belowSearch ? " is-below-search" : ""}`}
      role="status"
      onMouseDown={(event: React.MouseEvent) => event.stopPropagation()}
      onKeyDown={(event: React.KeyboardEvent) => event.stopPropagation()}
    >
      <span>
        {t("Filtering: ${tags} (${matched} / ${total} cards)", {
          tags: labels.join(t(", ")),
          matched: String(matched),
          total: String(total),
        })}
      </span>
      <button
        type="button"
        className="owb-filter-banner-clear"
        onClick={onClear}
      >
        {t("Clear filter")}
      </button>
    </div>
  );
}
