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
  CARD_ROW_FOCUS_CLASS,
  CARD_ROW_ON_BOARD_CLASS,
  isCardRowOnBoard,
} from "./cardRowOnBoard";
import {
  CARD_CHILD_INDENT_PX,
  cardTreePlanEqual,
  FOLDING_HANDLE_SELECTOR,
  planCardBlockTree,
} from "./cardTreePlan";
import {
  CARD_TREE_LOAD_MAX_DEPTH,
  CARD_TREE_LOAD_MAX_NODES,
} from "./cardTreeLoad";
import {
  cachedBlockPlainText,
  cardExcerpt,
  collectBlockTreeIds,
} from "./viewTransform";
import { CardErrorBoundary } from "./CardErrorBoundary";
import type { WhiteboardCard } from "./data";
import { attachCardRefHoverPreview } from "./hoverPreview";
import { attachMediaRefJump } from "./mediaRefJump";
import { attachMediaAutoplayGuard } from "./mediaAutoplay";

const { useEffect, useRef } = window.React;

const CONNECT_DRAG_PX = 4;

function RowConnectButton({
  card,
  rowId,
  onStartConnect,
}: {
  card: WhiteboardCard;
  rowId: DbId;
  onStartConnect: (
    card: WhiteboardCard,
    event: React.MouseEvent,
    mode: "drag" | "click",
    fromBlock?: DbId,
  ) => void;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const trackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      trackRef.current?.();
      trackRef.current = null;
    };
  }, []);

  const onMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    trackRef.current?.();
    const originX = event.clientX;
    const originY = event.clientY;
    let fired = false;
    const startEvent = event;

    const fire = (mode: "drag" | "click") => {
      if (fired) return;
      fired = true;
      detach();
      onStartConnect(card, startEvent, mode, rowId);
      if (mode === "click") {
        btnRef.current?.classList.add("is-connecting");
      }
    };

    const onMove = (move: MouseEvent) => {
      if (
        Math.hypot(move.clientX - originX, move.clientY - originY) <=
        CONNECT_DRAG_PX
      ) {
        return;
      }
      fire("drag");
    };
    const onUp = () => fire("click");
    const detach = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (trackRef.current === detach) trackRef.current = null;
    };

    trackRef.current = detach;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <button
      type="button"
      ref={btnRef}
      className="owb-row-connect-btn"
      title={t("Connect from this block")}
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <i className="ti ti-arrow-up-right" />
    </button>
  );
}

export const CARD_ROW_HIGHLIGHT_CLASS = "owb-card-row-highlight";

type Props = {
  panelId: string;
  card?: WhiteboardCard;
  blockId: DbId;
  promotedKey?: string;
  highlightedRowIds?: ReadonlySet<DbId>;
  onFocusCard?: (blockId: DbId) => void;
  onStartConnect?: (
    card: WhiteboardCard,
    event: React.MouseEvent,
    mode: "drag" | "click",
    fromBlock?: DbId,
  ) => void;
};

function liveBlocks() {
  return orca.state.blocks;
}

function stopRowFocusGesture(event: {
  stopPropagation: () => void;
  nativeEvent?: { stopImmediatePropagation?: () => void };
}): void {
  event.stopPropagation();
  event.nativeEvent?.stopImmediatePropagation?.();
}

export function CardBlockTree({
  panelId,
  card,
  blockId,
  promotedKey = "",
  highlightedRowIds,
  onFocusCard,
  onStartConnect,
}: Props) {
  const treeRef = useRef<HTMLDivElement | null>(null);
  const boardCardIds = parseIdKey(promotedKey);
  useEffect(() => {
    const el = treeRef.current;
    if (el == null) return;
    const detachPreview = attachCardRefHoverPreview(el);
    const detachJump = attachMediaRefJump(el);
    const detachAutoplay = attachMediaAutoplayGuard(el);
    return () => {
      detachAutoplay();
      detachJump();
      detachPreview();
    };
  }, []);

  const plan = useWatchedValue(
    () =>
      planCardBlockTree(
        blockId,
        liveBlocks(),
        CARD_TREE_LOAD_MAX_DEPTH,
        CARD_TREE_LOAD_MAX_NODES,
        boardCardIds,
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
    <CardErrorBoundary key={blockId}>
    <div
      ref={treeRef}
      className="owb-card-block-tree"
      onMouseDown={(event) => {
        const target = event.target as HTMLElement | null;
        if (
          target?.closest(
            `.${EXTRACT_BULLET_CLASS}, .${CARD_ROW_FOCUS_CLASS}, .owb-row-connect-btn, ${FOLDING_HANDLE_SELECTOR}`,
          )
        ) {
          event.stopPropagation();
        }
      }}
      onDragStartCapture={(event) => {
        stampExtractDragIfChild(event, blockId);
      }}
    >
      {plan.map((node) => {
        const onBoard = isCardRowOnBoard(node.id, blockId, boardCardIds);
        const isHighlighted = highlightedRowIds?.has(node.id) ?? false;
        const nodeClassName = [
          "owb-card-block-node",
          onBoard ? `${CARD_ROW_ON_BOARD_CLASS} ${CARD_ROW_FOCUS_CLASS}` : "",
          isHighlighted ? CARD_ROW_HIGHLIGHT_CLASS : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div
            key={node.id}
            className={nodeClassName}
            title={onBoard ? t("Locate on whiteboard") : undefined}
            onClick={
              onBoard
                ? (event) => {
                    if (
                      (event.target as HTMLElement | null)?.closest(
                        `.${EXTRACT_BULLET_CLASS}, .owb-row-connect-btn, ${FOLDING_HANDLE_SELECTOR}`,
                      )
                    ) {
                      return;
                    }
                    event.preventDefault();
                    stopRowFocusGesture(event);
                    onFocusCard?.(node.id);
                  }
                : undefined
            }
            data-depth={node.depth}
            data-owb-row-id={node.id}
            data-block-id={node.promoted ? undefined : node.id}
            style={
              node.depth > 0
                ? { paddingLeft: node.depth * CARD_CHILD_INDENT_PX }
                : undefined
            }
          >
            {isExtractableDepth(node.depth) && !node.promoted ? (
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
              /* Root and already-extracted rows keep a static bullet so the
                 left edge stays aligned. */
              <span
                className={`${EXTRACT_BULLET_CLASS} is-root`}
                aria-hidden="true"
              />
            )}
            {node.promoted ? (
              <span
                className="orca-inline owb-card-ref-row"
                data-type="r"
                data-ref={node.id}
              >
                {cardExcerpt(
                  cachedBlockPlainText(
                    node.id,
                    liveBlocks(),
                    CARD_TREE_LOAD_MAX_NODES,
                    CARD_TREE_LOAD_MAX_DEPTH,
                  ),
                ) || t("Extracted as a card")}
              </span>
            ) : (
              <orca.components.Block
                panelId={panelId}
                blockId={node.id}
                blockLevel={node.depth}
                indentLevel={node.depth}
                renderingMode={node.hostOwn ? "normal" : "simple"}
              />
            )}
            {card != null && onStartConnect != null ? (
              <RowConnectButton
                card={card}
                rowId={node.id}
                onStartConnect={onStartConnect}
              />
            ) : null}
          </div>
        );
      })}
    </div>
    </CardErrorBoundary>
  );
}
