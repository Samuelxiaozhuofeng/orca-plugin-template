import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { useWatchedValue } from "./blockWatch";
import type { WhiteboardCard } from "./cards";
import type { CanvasFocusApi } from "./cardFocus";
import { findVacantCardPosition } from "./cardExtract";
import { planGetBlocksBatches } from "./cardTreeLoad";
import { cardFromBlock } from "./dropBlocks";
import { cacheBlockList } from "./newCard";
import {
  collectCardRelations,
  relationFetchIds,
  relationKind,
  relationKindIcon,
  relationMapFingerprint,
  relationMapWatchIds,
  relationSnippet,
  relationTitle,
  type RelationMapModel,
  type RelationNode,
} from "./cardRelations";

const { useCallback, useEffect, useMemo, useRef, useState } = window.React;

const EMPTY_MODEL: RelationMapModel = {
  total: 0,
  offBoard: 0,
  onBoard: 0,
  hidden: 0,
  incomingTotal: 0,
  outgoingTotal: 0,
  incoming: [],
  outgoing: [],
  shown: [],
  offBoardIds: [],
};

function liveBlocks(): { [id: number]: Block | undefined } {
  return orca.state.blocks as { [id: number]: Block | undefined };
}

function stopMapPointer(event: React.SyntheticEvent): void {
  event.stopPropagation();
}

async function fetchRelationBlocks(ids: readonly DbId[]): Promise<void> {
  const missing = ids.filter((id) => orca.state.blocks[id] == null);
  if (missing.length === 0) return;
  for (const batch of planGetBlocksBatches(missing)) {
    const loaded = (await orca.invokeBackend("get-blocks", batch)) as unknown;
    if (Array.isArray(loaded)) cacheBlockList(loaded);
  }
}

function useCardRelationModel(
  rootId: DbId | null,
  cards: readonly WhiteboardCard[],
): RelationMapModel {
  const cacheKey = cards.map((card) => card.blockId).join(",");
  const key = useWatchedValue(
    () => {
      if (rootId == null) return "";
      return relationMapFingerprint(
        rootId,
        cards.map((card) => card.blockId),
        liveBlocks(),
      );
    },
    () => (rootId == null ? [] : relationMapWatchIds(rootId, liveBlocks())),
    [rootId, cacheKey],
  );
  return useMemo(() => {
    if (rootId == null) return EMPTY_MODEL;
    return collectCardRelations(rootId, cards, liveBlocks());
  }, [rootId, cacheKey, key]);
}

function rowLabel(node: RelationNode, blocks: { [id: number]: Block | undefined }): string {
  const title = relationTitle(node.blockId, blocks);
  return title === "" ? t("Untitled") : title;
}

export function RelationMap(props: {
  boardBlockId: DbId;
  cards: readonly WhiteboardCard[];
  selected: readonly DbId[];
  onAddCards: (cards: WhiteboardCard[]) => Promise<boolean>;
  selectCards: (ids: DbId[]) => void;
  focusApiRef: { current: CanvasFocusApi | null };
}) {
  const { boardBlockId, cards, selected, onAddCards, selectCards, focusApiRef } =
    props;
  const rootId = selected.length === 1 ? selected[0] : null;
  const model = useCardRelationModel(rootId, cards);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<{
    node: RelationNode;
    section: "in" | "out";
  } | null>(null);
  const [dataTick, setDataTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const fetchGen = useRef(0);

  useEffect(() => {
    setOpen(false);
    setHover(null);
  }, [rootId]);

  useEffect(() => {
    if (!open || rootId == null || model.total === 0) return;
    const gen = ++fetchGen.current;
    void fetchRelationBlocks(relationFetchIds(model)).then(() => {
      if (gen !== fetchGen.current) return;
      setDataTick((n: number) => n + 1);
    });
  }, [open, rootId, model]);

  const addIds = useCallback(
    async (ids: readonly DbId[]) => {
      if (ids.length === 0 || busy) return;
      setBusy(true);
      try {
        await fetchRelationBlocks(ids);
        const source = cards.find((card) => card.blockId === rootId);
        const placed = [...cards];
        const incoming: WhiteboardCard[] = [];
        let prefer = source;
        for (const id of ids) {
          if (id === boardBlockId) continue;
          if (placed.some((card) => card.blockId === id)) continue;
          const at = findVacantCardPosition(placed, prefer);
          const card = cardFromBlock(id, at.x, at.y, liveBlocks());
          incoming.push(card);
          placed.push(card);
          prefer = card;
        }
        if (incoming.length === 0) {
          orca.notify("info", t("Nothing to add to the board"));
          return;
        }
        const ok = await onAddCards(incoming);
        if (!ok) return;
        selectCards(incoming.map((card) => card.blockId));
        orca.notify(
          "success",
          t("Added ${added} cards", { added: String(incoming.length) }),
        );
      } catch (error) {
        console.error("[whiteboard] relation map add failed", error);
        orca.notify("error", t("Failed to add blocks to the board"));
      } finally {
        setBusy(false);
      }
    },
    [boardBlockId, busy, cards, onAddCards, rootId, selectCards],
  );

  if (rootId == null || model.total === 0) return null;

  void dataTick;
  const blocks = liveBlocks();
  const snippet =
    hover == null ? "" : relationSnippet(hover.node, hover.section, blocks);
  const selfTitle = relationTitle(rootId, blocks);

  const renderRow = (node: RelationNode, section: "in" | "out") => {
    const kind = relationKind(blocks[node.blockId]);
    return (
      <div
        key={`${section}-${node.blockId}`}
        className={`owb-relmap-row${node.onBoard ? " is-on" : " is-off"}`}
        onMouseEnter={() => setHover({ node, section })}
        onClick={() => {
          if (node.onBoard && node.ownerCardId != null) {
            focusApiRef.current?.focusCard(node.ownerCardId);
          }
        }}
        onDoubleClick={() => {
          if (!node.onBoard) void addIds([node.blockId]);
        }}
      >
        <i className={relationKindIcon(kind)} />
        <span className="owb-relmap-row-title">{rowLabel(node, blocks)}</span>
        {node.onBoard ? null : (
          <button
            type="button"
            className="owb-relmap-plus"
            title={t("Add to the board")}
            aria-label={t("Add to the board")}
            onClick={(event: React.MouseEvent) => {
              event.stopPropagation();
              void addIds([node.blockId]);
            }}
          >
            <i className="ti ti-plus" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      className={`owb-relmap${open ? " is-open" : ""}`}
      onMouseDown={stopMapPointer}
      onDoubleClick={stopMapPointer}
      onWheel={(event: React.WheelEvent) => {
        event.stopPropagation();
        event.preventDefault();
      }}
    >
      {open ? (
        <div className="owb-relmap-panel">
          <div className="owb-relmap-head">
            <span>{t("Relations · ${count}", { count: String(model.total) })}</span>
            <button
              type="button"
              className="owb-relmap-collapse"
              title={t("Collapse")}
              aria-label={t("Collapse")}
              onClick={() => setOpen(false)}
            >
              <i className="ti ti-chevron-down" />
            </button>
          </div>
          <div
            className="owb-relmap-section"
            onMouseLeave={() => setHover(null)}
          >
            <div className="owb-relmap-label">
              {t("References me · ${count}", {
                count: String(model.incomingTotal),
              })}
            </div>
            {model.incoming.map((node) => renderRow(node, "in"))}
          </div>
          <div className="owb-relmap-self">
            {selfTitle === "" ? t("Untitled") : selfTitle}
          </div>
          <div
            className="owb-relmap-section"
            onMouseLeave={() => setHover(null)}
          >
            <div className="owb-relmap-label">
              {t("I reference · ${count}", {
                count: String(model.outgoingTotal),
              })}
            </div>
            {model.outgoing.map((node) => renderRow(node, "out"))}
          </div>
          <div className="owb-relmap-snippet">
            {hover == null
              ? t("Hover a row to see the line that made the link.")
              : snippet}
          </div>
          <div className="owb-relmap-foot">
            <span className="owb-relmap-stat">
              {t("Off-board ${count}", { count: String(model.offBoard) })}
            </span>
            <button
              type="button"
              className="owb-relmap-add"
              disabled={busy || model.offBoard === 0}
              onClick={() => void addIds(model.offBoardIds)}
            >
              {t("Add all to the board")}
            </button>
          </div>
          {model.hidden > 0 ? (
            <div className="owb-relmap-more">
              {t("${count} more not shown", { count: String(model.hidden) })}
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          className="owb-relmap-capsule"
          aria-label={t("${count} relations", { count: String(model.total) })}
          onClick={() => setOpen(true)}
        >
          <i className="ti ti-affiliate" />
          <span className="owb-relmap-count">{model.total}</span>
        </button>
      )}
    </div>
  );
}
