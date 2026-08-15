import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { useWatchedValue } from "./blockWatch";
import {
  EXTRACT_BULLET_CLASS,
  stampExtractDragIfChild,
  startExtractBulletDrag,
} from "./cardExtractDrag";
import { isExtractableDepth, parseIdKey } from "./cardExtract";
import {
  CARD_CHILD_INDENT_PX,
  cardTreePlanEqual,
  planCardBlockTree,
} from "./cardTreePlan";
import {
  CARD_TREE_LOAD_MAX_DEPTH,
  CARD_TREE_LOAD_MAX_NODES,
} from "./cardTreeLoad";
import { collectBlockTreeIds } from "./viewTransform";

type Props = {
  panelId: string;
  blockId: DbId;
  promotedKey?: string;
};

function liveBlocks() {
  return orca.state.blocks;
}

export function CardBlockTree({
  panelId,
  blockId,
  promotedKey = "",
}: Props) {
  const plan = useWatchedValue(
    () =>
      planCardBlockTree(
        blockId,
        liveBlocks(),
        CARD_TREE_LOAD_MAX_DEPTH,
        CARD_TREE_LOAD_MAX_NODES,
        parseIdKey(promotedKey),
      ),
    () =>
      collectBlockTreeIds(
        [blockId],
        liveBlocks(),
        CARD_TREE_LOAD_MAX_NODES,
        CARD_TREE_LOAD_MAX_DEPTH,
      ),
    [panelId, blockId, promotedKey],
    cardTreePlanEqual,
  );

  return (
    <div
      className="owb-card-block-tree"
      onMouseDown={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest(`.${EXTRACT_BULLET_CLASS}`)) {
          event.stopPropagation();
        }
      }}
      onDragStartCapture={(event) => {
        stampExtractDragIfChild(event, blockId);
      }}
    >
      {plan.map((node) => (
        <div
          key={node.id}
          className="owb-card-block-node"
          data-depth={node.depth}
          data-block-id={node.id}
          style={
            node.depth > 0
              ? { paddingLeft: node.depth * CARD_CHILD_INDENT_PX }
              : undefined
          }
        >
          {isExtractableDepth(node.depth) ? (
            <span
              className={EXTRACT_BULLET_CLASS}
              title={t("Drag to extract as a card")}
              draggable
              onDragStart={(event) => {
                startExtractBulletDrag(event, blockId, node.id);
              }}
              onDrag={(event) => {
                event.stopPropagation();
                if (event.nativeEvent) event.nativeEvent.stopImmediatePropagation();
              }}
              onDragEnd={(event) => {
                event.stopPropagation();
                if (event.nativeEvent) event.nativeEvent.stopImmediatePropagation();
              }}
              onDoubleClick={(event) => event.stopPropagation()}
            />
          ) : (
            /* The root row is the card itself, so it cannot be extracted,
               but it still gets a bullet so the outline reads evenly. */
            <span
              className={`${EXTRACT_BULLET_CLASS} is-root`}
              aria-hidden="true"
            />
          )}
          <orca.components.Block
            panelId={panelId}
            blockId={node.id}
            blockLevel={node.depth}
            indentLevel={node.depth}
            renderingMode={node.hostOwn ? "normal" : "simple"}
          />
        </div>
      ))}
    </div>
  );
}
