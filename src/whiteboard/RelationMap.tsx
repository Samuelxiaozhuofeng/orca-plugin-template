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
  type RelationDir,
  type RelationMapModel,
  type RelationNode,
} from "./cardRelations";

const { useCallback, useEffect, useMemo, useRef, useState } = window.React;

type TabKey = "all" | "in" | "out";

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

function rowLabel(
  node: RelationNode,
  blocks: { [id: number]: Block | undefined },
): string {
  const title = relationTitle(node.blockId, blocks);
  return title === "" ? t("Untitled") : title;
}

function renderDirBadge(dir: RelationDir): React.ReactNode {
  if (dir === "both") {
    return (
      <span className="owb-relmap-dir is-both" title={t("Two-way relation")}>
        <i className="ti ti-arrows-exchange" />
      </span>
    );
  }
  if (dir === "in") {
    return (
      <span className="owb-relmap-dir is-in" title={t("References me")}>
        <i className="ti ti-arrow-down-left" />
      </span>
    );
  }
  return (
    <span className="owb-relmap-dir is-out" title={t("I reference")}>
      <i className="ti ti-arrow-up-right" />
    </span>
  );
}

export function RelationMap(props: {
  boardBlockId: DbId;
  cards: readonly WhiteboardCard[];
  selected: readonly DbId[];
  onAddCards: (cards: WhiteboardCard[]) => Promise<boolean>;
  selectCards: (ids: DbId[]) => void;
  focusApiRef: { current: CanvasFocusApi | null };
}) {
  const {
    boardBlockId,
    cards,
    selected,
    onAddCards,
    selectCards,
    focusApiRef,
  } = props;
  const rootId = selected.length === 1 ? selected[0] : null;
  const model = useCardRelationModel(rootId, cards);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("all");
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
    setTab("all");
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

  const activeNodes = useMemo(() => {
    if (tab === "in") return model.incoming;
    if (tab === "out") return model.outgoing;
    return model.shown;
  }, [tab, model]);

  const offBoardList = useMemo(
    () => activeNodes.filter((node: RelationNode) => !node.onBoard),
    [activeNodes],
  );
  const onBoardList = useMemo(
    () => activeNodes.filter((node: RelationNode) => node.onBoard),
    [activeNodes],
  );

  if (rootId == null || model.total === 0) return null;

  void dataTick;
  const blocks = liveBlocks();
  const snippet =
    hover == null ? "" : relationSnippet(hover.node, hover.section, blocks);
  const selfTitle = relationTitle(rootId, blocks);

  const renderNodeRow = (node: RelationNode) => {
    const kind = relationKind(blocks[node.blockId]);
    const section: "in" | "out" =
      tab === "out" ? "out" : tab === "in" ? "in" : node.dir === "out" ? "out" : "in";
    const label = rowLabel(node, blocks);

    return (
      <div
        key={`${node.blockId}-${node.dir}`}
        className={`owb-relmap-item${node.onBoard ? " is-onboard" : " is-offboard"}`}
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
        <div className="owb-relmap-item-main">
          <i className={`owb-relmap-kind-icon ${relationKindIcon(kind)}`} />
          <span className="owb-relmap-item-title" title={label}>
            {label}
          </span>
          {renderDirBadge(node.dir)}
        </div>
        <div className="owb-relmap-item-actions">
          {node.onBoard ? (
            <span className="owb-relmap-pill is-on" title={t("Locate card")}>
              <i className="ti ti-target" />
            </span>
          ) : (
            <button
              type="button"
              className="owb-relmap-action-btn"
              title={t("Add to board")}
              aria-label={t("Add to board")}
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                void addIds([node.blockId]);
              }}
            >
              <i className="ti ti-plus" />
            </button>
          )}
        </div>
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
      }}
    >
      {open ? (
        <div className="owb-relmap-panel" onMouseLeave={() => setHover(null)}>
          {/* Header */}
          <div className="owb-relmap-header">
            <div className="owb-relmap-header-title">
              <i className="ti ti-affiliate owb-relmap-header-icon" />
              <span className="owb-relmap-header-text">
                {t("Relations · ${count}", { count: String(model.total) })}
              </span>
            </div>
            <div className="owb-relmap-header-actions">
              {model.offBoard > 0 ? (
                <button
                  type="button"
                  className="owb-relmap-add-all-btn"
                  disabled={busy}
                  onClick={() => void addIds(model.offBoardIds)}
                  title={t("Add all to the board")}
                >
                  <i className="ti ti-plus" />
                  <span>{t("Add all (${count})", { count: String(model.offBoard) })}</span>
                </button>
              ) : null}
              <button
                type="button"
                className="owb-relmap-close-btn"
                title={t("Collapse")}
                aria-label={t("Collapse")}
                onClick={() => setOpen(false)}
              >
                <i className="ti ti-x" />
              </button>
            </div>
          </div>

          {/* Current Card Banner */}
          <div className="owb-relmap-current-card">
            <span className="owb-relmap-current-tag">{t("Current")}</span>
            <span className="owb-relmap-current-title">
              {selfTitle === "" ? t("Untitled") : selfTitle}
            </span>
          </div>

          {/* Segmented Control Tabs */}
          <div className="owb-relmap-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "all"}
              className={`owb-relmap-tab${tab === "all" ? " is-active" : ""}`}
              onClick={() => setTab("all")}
            >
              <span>{t("All · ${count}", { count: String(model.total) })}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "in"}
              className={`owb-relmap-tab${tab === "in" ? " is-active" : ""}`}
              onClick={() => setTab("in")}
            >
              <span>{t("References me · ${count}", { count: String(model.incomingTotal) })}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "out"}
              className={`owb-relmap-tab${tab === "out" ? " is-active" : ""}`}
              onClick={() => setTab("out")}
            >
              <span>{t("I reference · ${count}", { count: String(model.outgoingTotal) })}</span>
            </button>
          </div>

          {/* Scrollable Content List */}
          <div className="owb-relmap-body">
            {activeNodes.length === 0 ? (
              <div className="owb-relmap-empty">
                <i className="ti ti-inbox" />
                <span>{t("No relations found in this category.")}</span>
              </div>
            ) : (
              <>
                {offBoardList.length > 0 ? (
                  <div className="owb-relmap-group">
                    <div className="owb-relmap-group-title">
                      <span className="owb-relmap-group-dot is-off" />
                      <span>{t("Off-board (${count})", { count: String(offBoardList.length) })}</span>
                    </div>
                    <div className="owb-relmap-group-list">
                      {offBoardList.map(renderNodeRow)}
                    </div>
                  </div>
                ) : null}

                {onBoardList.length > 0 ? (
                  <div className="owb-relmap-group">
                    <div className="owb-relmap-group-title">
                      <span className="owb-relmap-group-dot is-on" />
                      <span>{t("On-board (${count})", { count: String(onBoardList.length) })}</span>
                    </div>
                    <div className="owb-relmap-group-list">
                      {onBoardList.map(renderNodeRow)}
                    </div>
                  </div>
                ) : null}

                {model.hidden > 0 ? (
                  <div className="owb-relmap-more">
                    {t("${count} more not shown", { count: String(model.hidden) })}
                  </div>
                ) : null}
              </>
            )}
          </div>

          {/* Dynamic Context Preview Snippet */}
          <div className={`owb-relmap-preview${hover != null && snippet ? " is-active" : ""}`}>
            <i className={`ti ${hover != null && snippet ? "ti-quote" : "ti-info-circle"}`} />
            <span className="owb-relmap-preview-text">
              {hover != null && snippet
                ? snippet
                : t("Hover a row to see the line that made the link.")}
            </span>
          </div>

          {/* Footer Stats & Hints */}
          <div className="owb-relmap-footer">
            <span className="owb-relmap-stat-text">
              {t("On board ${on}, Off board ${off}", {
                on: String(model.onBoard),
                off: String(model.offBoard),
              })}
            </span>
            <span className="owb-relmap-hint-text">
              {t("Double-click or click + to add to board")}
            </span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="owb-relmap-capsule"
          aria-label={t("${count} relations", { count: String(model.total) })}
          onClick={() => setOpen(true)}
        >
          <i className="ti ti-affiliate" />
          <span className="owb-relmap-capsule-label">{t("Relations · ${count}", { count: String(model.total) })}</span>
          {model.offBoard > 0 ? (
            <span className="owb-relmap-capsule-badge" title={t("Off-board ${count}", { count: String(model.offBoard) })}>
              +{model.offBoard}
            </span>
          ) : null}
        </button>
      )}
    </div>
  );
}
