import { t } from "../libs/l10n";
import type { ArrangeAction } from "./selection";

type Props = {
  close: () => void;
  selectedCount: number;
  onArrange: (action: ArrangeAction) => void;
};

export function ArrangeMenuItems({
  close,
  selectedCount,
  onArrange,
}: Props) {
  if (selectedCount < 2) return null;

  const item = (action: ArrangeAction, title: string, min = 2) => (
    <orca.components.MenuText
      title={title}
      disabled={selectedCount < min}
      onClick={() => {
        if (selectedCount < min) return;
        close();
        onArrange(action);
      }}
    />
  );

  return (
    <>
      <orca.components.MenuSeparator />
      <orca.components.MenuTitle title={t("Arrange")} />
      {item("alignLeft", t("Align left"))}
      {item("alignCenterX", t("Align horizontal centers"))}
      {item("alignRight", t("Align right"))}
      {item("alignTop", t("Align top"))}
      {item("alignCenterY", t("Align vertical centers"))}
      {item("alignBottom", t("Align bottom"))}
      {item("distributeX", t("Distribute horizontally"), 3)}
      {item("distributeY", t("Distribute vertically"), 3)}
      {item("grid", t("Tidy up to grid"))}
    </>
  );
}
