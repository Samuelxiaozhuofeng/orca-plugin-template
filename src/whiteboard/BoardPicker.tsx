import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";

const { useMemo, useState } = window.React;

export type BoardPickerRow = {
  id: DbId;
  name: string;
  meta: string;
};

export function BoardPicker(props: {
  title: string;
  emptyHint: string;
  noMatchHint?: string;
  loadingHint?: string;
  error: string | null;
  items: BoardPickerRow[] | null;
  busyId?: DbId | null;
  onClose: () => void;
  onPick: (id: DbId) => void;
}): React.ReactNode {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (props.items == null) return [];
    const needle = query.trim().toLowerCase();
    if (needle === "") return props.items;
    return props.items.filter((item: BoardPickerRow) =>
      item.name.toLowerCase().includes(needle),
    );
  }, [props.items, query]);

  return (
    <orca.components.ModalOverlay visible canClose onClose={props.onClose}>
      <div className="owb-dialog" role="dialog">
        <div className="owb-dialog-title">{props.title}</div>
        <input
          className="owb-board-search"
          type="search"
          value={query}
          autoFocus
          placeholder={t("Search whiteboards")}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setQuery(event.target.value)
          }
        />
        {props.error != null ? (
          <div className="owb-dialog-warn">{props.error}</div>
        ) : props.items == null ? (
          <div className="owb-dialog-hint">
            {props.loadingHint ?? t("Loading whiteboards…")}
          </div>
        ) : props.items.length === 0 ? (
          <div className="owb-dialog-hint">{props.emptyHint}</div>
        ) : filtered.length === 0 ? (
          <div className="owb-dialog-hint">
            {props.noMatchHint ?? t("No matching whiteboards")}
          </div>
        ) : (
          <div className="owb-board-list">
            {filtered.map((item: BoardPickerRow) => (
              <button
                key={item.id}
                type="button"
                className="owb-board-item"
                disabled={props.busyId != null}
                onClick={() => props.onPick(item.id)}
              >
                <span className="owb-board-item-name">{item.name}</span>
                <span className="owb-board-item-count">{item.meta}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </orca.components.ModalOverlay>
  );
}
