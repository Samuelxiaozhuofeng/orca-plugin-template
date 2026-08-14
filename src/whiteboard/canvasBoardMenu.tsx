import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { ArrangeMenuItems } from "./ArrangeMenu";
import type { WhiteboardCard } from "./data";
import type { ArrangeAction } from "./selection";

export function canOpenBoardMenu(
  selectedRef: { current: readonly DbId[] },
  cardsRef: { current: readonly WhiteboardCard[] },
): boolean {
  if (selectedRef.current.length >= 2) return true;
  return (
    selectedRef.current.length === 0 && cardsRef.current.length > 0
  );
}

export function boardMenu(
  close: () => void,
  opts: {
    selected: readonly DbId[];
    cards: readonly WhiteboardCard[];
    cardsRef: { current: WhiteboardCard[] };
    selectCards: (ids: DbId[]) => void;
    applyArrange: (action: ArrangeAction) => void;
  },
) {
  return (
    <orca.components.Menu>
      {opts.selected.length === 0 && opts.cards.length > 0 ? (
        <orca.components.MenuText
          title={t("Select all")}
          onClick={() => {
            close();
            opts.selectCards(
              opts.cardsRef.current.map((card: WhiteboardCard) => card.blockId),
            );
          }}
        />
      ) : null}
      <ArrangeMenuItems
        close={close}
        selectedCount={opts.selected.length}
        onArrange={opts.applyArrange}
        leadingSeparator={false}
      />
    </orca.components.Menu>
  );
}
