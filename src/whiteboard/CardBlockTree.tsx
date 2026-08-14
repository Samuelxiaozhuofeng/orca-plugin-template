import type { DbId } from "../orca.d.ts";
import { useWatchedValue } from "./blockWatch";
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
};

function liveBlocks() {
  return orca.state.blocks;
}

export function CardBlockTree({ panelId, blockId }: Props) {
  const plan = useWatchedValue(
    () =>
      planCardBlockTree(
        blockId,
        liveBlocks(),
        CARD_TREE_LOAD_MAX_DEPTH,
        CARD_TREE_LOAD_MAX_NODES,
      ),
    () =>
      collectBlockTreeIds(
        [blockId],
        liveBlocks(),
        CARD_TREE_LOAD_MAX_NODES,
        CARD_TREE_LOAD_MAX_DEPTH,
      ),
    [panelId, blockId],
    cardTreePlanEqual,
  );

  return (
    <div className="owb-card-block-tree">
      {plan.map((node) => (
        <div
          key={node.id}
          className="owb-card-block-node"
          data-depth={node.depth}
          style={
            node.depth > 0
              ? { paddingLeft: node.depth * CARD_CHILD_INDENT_PX }
              : undefined
          }
        >
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
