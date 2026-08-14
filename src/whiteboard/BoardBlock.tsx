import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { boardName, openBoard, readCards } from "./data";

const { useMemo } = window.React;
const { useSnapshot } = window.Valtio;

type Props = {
  panelId: string;
  blockId: DbId;
  rndId: string;
  blockLevel: number;
  indentLevel: number;
  mirrorId?: DbId;
  initiallyCollapsed?: boolean;
  renderingMode?: "normal" | "simple" | "simple-children";
};

export default function BoardBlock({
  panelId,
  blockId,
  rndId,
  blockLevel,
  indentLevel,
  mirrorId,
  initiallyCollapsed,
  renderingMode,
}: Props) {
  const { blocks } = useSnapshot(orca.state);
  const dataBlockId = mirrorId ?? blockId;
  const block = blocks[dataBlockId];
  const cards = readCards(block);

  const childrenBlocks = useMemo(
    () => (
      <orca.components.BlockChildren
        blockId={blockId}
        panelId={panelId}
        blockLevel={blockLevel}
        indentLevel={indentLevel}
        renderingMode={renderingMode}
      />
    ),
    [blockId, panelId, blockLevel, indentLevel, renderingMode],
  );

  const onOpen = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    openBoard(dataBlockId, panelId, event.metaKey || event.ctrlKey);
  };

  return (
    <orca.components.BlockShell
      panelId={panelId}
      blockId={blockId}
      rndId={rndId}
      mirrorId={mirrorId}
      blockLevel={blockLevel}
      indentLevel={indentLevel}
      initiallyCollapsed={initiallyCollapsed}
      renderingMode={renderingMode}
      reprClassName="owb-repr"
      contentClassName="owb-repr-content"
      contentAttrs={{ contentEditable: false }}
      contentJsx={
        <div className="owb-block-card">
          <span className="owb-block-title">{boardName(block)}</span>
          <span className="owb-block-count">
            {t("${count} cards", { count: String(cards.length) })}
          </span>
          <orca.components.Button variant="soft" onClick={onOpen}>
            {t("Open")}
          </orca.components.Button>
        </div>
      }
      childrenJsx={childrenBlocks}
    />
  );
}
