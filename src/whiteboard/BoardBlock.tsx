import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { tryReadCards } from "./cards";
import { boardName, openBoard } from "./data";
import { tryReadEdges } from "./edges";
import { useOpenWhiteboardPageAsCanvas } from "./useOpenWhiteboardPage";

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
  useOpenWhiteboardPageAsCanvas(panelId, blockId);
  const dataBlockId = mirrorId ?? blockId;
  const block = blocks[dataBlockId];
  const cardsRead = tryReadCards(block);
  const edgesRead = tryReadEdges(block);
  const protect = !cardsRead.ok || !edgesRead.ok;

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
        <div className="owb-block-card" onClick={onOpen}>
          <i className="ti ti-chalkboard owb-block-icon" />
          <span className="owb-block-title">{boardName(block)}</span>
          <span
            className={
              protect ? "owb-block-count owb-block-count-error" : "owb-block-count"
            }
          >
            {protect
              ? t("Board data unreadable; saving stopped")
              : t("${count} cards", { count: String(cardsRead.value.length) })}
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
