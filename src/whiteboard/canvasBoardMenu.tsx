import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { ArrangeMenuItems } from "./ArrangeMenu";
import type { WhiteboardCard } from "./data";
import type { ArrangeAction } from "./selection";

const { useRef } = window.React;

function pointRect(x: number, y: number): DOMRect {
  return new DOMRect(x, y, 1, 1);
}

export type BoardMenuOptions = {
  selected: readonly DbId[];
  cards: readonly WhiteboardCard[];
  cardsRef: { current: WhiteboardCard[] };
  selectCards: (ids: DbId[]) => void;
  applyArrange: (action: ArrangeAction, ids?: readonly DbId[]) => void;
  /** New blank card at the point that was right-clicked. */
  onNewCard: () => void;
  /** Search an existing note and drop it at the right-clicked point. */
  onAddFromNote: () => void;
  /** Journal placement dialog, anchored at the right-clicked point. */
  onPlaceJournals: () => void;
  onDrawArea: () => void;
  onFitAll: () => void;
};

export function boardMenu(close: () => void, opts: BoardMenuOptions) {
  const cards = opts.cardsRef.current;
  const allIds = () => cards.map((card: WhiteboardCard) => card.blockId);
  const hasCards = cards.length > 0;
  // The arrange group already carries its own "tidy up to grid" for the
  // selection, so the board-wide one only shows when that group is absent.
  const arranging = opts.selected.length >= 2;

  const run = (action: () => void) => () => {
    close();
    action();
  };

  return (
    <orca.components.Menu>
      <orca.components.MenuText
        title={t("New card here")}
        preIcon="ti ti-square-plus"
        onClick={run(opts.onNewCard)}
      />
      <orca.components.MenuText
        title={t("Add a note as a card…")}
        preIcon="ti ti-file-plus"
        onClick={run(opts.onAddFromNote)}
      />
      <orca.components.MenuText
        title={t("Place journals…")}
        preIcon="ti ti-calendar-plus"
        onClick={run(opts.onPlaceJournals)}
      />
      <orca.components.MenuText
        title={t("Draw section")}
        preIcon="ti ti-rectangle"
        onClick={run(opts.onDrawArea)}
      />
      <orca.components.MenuSeparator />
      <orca.components.MenuText
        title={t("Select all")}
        disabled={!hasCards}
        onClick={run(() => opts.selectCards(allIds()))}
      />
      {arranging ? null : (
        <orca.components.MenuText
          title={t("Tidy all cards up to grid")}
          disabled={cards.length < 2}
          onClick={run(() => opts.applyArrange("grid", allIds()))}
        />
      )}
      <ArrangeMenuItems
        close={close}
        selectedCount={opts.selected.length}
        onArrange={opts.applyArrange}
      />
      <orca.components.MenuSeparator />
      <orca.components.MenuText
        title={t("Zoom to fit")}
        disabled={!hasCards}
        onClick={run(opts.onFitAll)}
      />
    </orca.components.Menu>
  );
}

/** Anchors at the click, not the viewport box (that puts the menu off-screen). */
export function BoardContextMenu({
  at,
  onClose,
  opts,
}: {
  at: { x: number; y: number } | null;
  onClose: () => void;
  opts: BoardMenuOptions;
}) {
  const bodyRef = useRef(document.body);
  if (at == null) return null;
  return (
    <orca.components.Popup
      key={`${at.x},${at.y}`}
      visible
      rect={pointRect(at.x, at.y)}
      container={bodyRef}
      allowBeyondContainer
      escapeToClose
      defaultPlacement="bottom"
      alignment="left"
      onClose={onClose}
    >
      {boardMenu(onClose, opts)}
    </orca.components.Popup>
  );
}
