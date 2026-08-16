import {
  planSnapshotWrite,
  preserveLinked,
  resetAllHistory,
} from "./boardHistory.ts";
import type { WhiteboardArea } from "./areas.ts";
import type { WhiteboardCard } from "./cards.ts";
import {
  planCollectIntoBoard,
  planDropOntoBoard,
} from "./collectIntoBoard.ts";
import type { WhiteboardEdge } from "./edges.ts";
import { CARD_HEIGHT, CARD_WIDTH } from "./layout.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function card(
  id: number,
  extra: Partial<WhiteboardCard> = {},
): WhiteboardCard {
  return {
    blockId: id,
    kind: "block",
    x: 0,
    y: 0,
    w: CARD_WIDTH,
    h: CARD_HEIGHT,
    ...extra,
  };
}

function edge(
  from: number,
  to: number,
  extra: Partial<WhiteboardEdge> = {},
): WhiteboardEdge {
  return {
    id: `${from}-${to}-1`,
    from,
    to,
    arrow: "end",
    ...extra,
  };
}

function area(
  id: string,
  extra: Partial<WhiteboardArea> = {},
): WhiteboardArea {
  return { id, x: 0, y: 0, w: 200, h: 160, name: "Section", ...extra };
}

resetAllHistory();

const cardA = card(1, { x: 40, y: 40 });
const cardB = card(2, { x: 240, y: 40 });
const boardCard = card(900, { x: 480, y: 40 });
const lineAB = edge(1, 2, {
  bend: { from: { along: 1, across: 0.2 }, to: { along: 1, across: -0.1 } },
});

const beforeDrop = {
  cards: [cardA, cardB, boardCard],
  edges: [lineAB],
  areas: [] as WhiteboardArea[],
};
const dropPlan = planDropOntoBoard({
  cards: beforeDrop.cards,
  edges: beforeDrop.edges,
  movingIds: new Set([2]),
  targetBoardId: 900,
  currentBoardId: 10,
});
check(dropPlan != null, "drop plan exists");
const afterDrop = {
  cards: dropPlan!.leftoverCards,
  edges: dropPlan!.leftoverEdges,
  areas: [] as WhiteboardArea[],
};
const dropUndo = planSnapshotWrite(beforeDrop, afterDrop);
check(dropUndo.mode === "board", "drop undo writes cards+edges, not cards-only");
check(
  dropUndo.edges.length === 1 &&
    dropUndo.edges[0].from === 1 &&
    dropUndo.edges[0].to === 2,
  "drop undo restores the original A→B endpoints",
);
check(
  afterDrop.edges[0].to === 900,
  "sanity: leftover edge was remapped onto the board card",
);

const beforeCollect = {
  cards: [cardA, cardB, card(3, { x: 440, y: 40 })],
  edges: [edge(1, 3)],
  areas: [] as WhiteboardArea[],
};
const collectPlan = planCollectIntoBoard(
  beforeCollect.cards,
  beforeCollect.edges,
  new Set([2]),
  800,
);
check(collectPlan == null, "collect still needs two selected cards");
const collectTwo = planCollectIntoBoard(
  beforeCollect.cards,
  beforeCollect.edges,
  new Set([2, 3]),
  800,
);
check(collectTwo != null, "collect plan exists");
const collectUndo = planSnapshotWrite(beforeCollect, {
  cards: collectTwo!.leftoverCards,
  edges: collectTwo!.leftoverEdges,
  areas: [],
});
check(collectUndo.mode === "board", "collect undo writes cards+edges");
check(
  collectUndo.edges.some((item) => item.from === 1 && item.to === 3),
  "collect undo restores the remapped cross-border edge",
);

const moved = planSnapshotWrite(
  { cards: [cardA], edges: [], areas: [] },
  { cards: [card(1, { x: 80, y: 40 })], edges: [], areas: [] },
);
check(moved.mode === "board", "moving a card still goes through commitBoard");

const deleted = planSnapshotWrite(
  { cards: [cardA, cardB], edges: [lineAB], areas: [] },
  { cards: [cardA], edges: [], areas: [] },
);
check(deleted.mode === "board", "deleting a card+edge writes both back");
check(deleted.edges[0]?.to === 2, "delete-undo restores the dropped edge");

const drew = planSnapshotWrite(
  { cards: [cardA, cardB], edges: [], areas: [] },
  { cards: [cardA, cardB], edges: [lineAB], areas: [] },
);
check(drew.mode === "board", "undoing a drawn edge writes edges");
check(drew.edges.length === 0, "draw-undo restores the empty edge list");

const wrapped = planSnapshotWrite(
  { cards: [cardA, cardB], edges: [lineAB], areas: [] },
  {
    cards: [cardA, cardB],
    edges: [lineAB],
    areas: [area("area-1")],
  },
);
check(wrapped.mode === "areas", "wrapping a section only writes areas");

const areaMove = planSnapshotWrite(
  {
    cards: [cardA],
    edges: [lineAB],
    areas: [area("area-1", { x: 0, y: 0 })],
  },
  {
    cards: [card(1, { x: 40, y: 80 })],
    edges: [lineAB],
    areas: [area("area-1", { x: 0, y: 40 })],
  },
);
check(
  areaMove.mode === "cards-and-areas",
  "moving a section with cards skips the edge lane",
);

const missingAreas = planSnapshotWrite(
  { cards: [cardA, cardB], edges: [lineAB] },
  { cards: [cardA], edges: [edge(1, 900)], areas: [] },
);
check(
  missingAreas.mode === "board",
  "undefined vs empty areas does not hide an endpoint change",
);
check(
  missingAreas.edges[0]?.to === 2,
  "undefined-areas undo still restores A→B",
);

const snapPlain = [edge(1, 2)];
const liveLinked = [edge(1, 2, { linked: true, linkRefId: 99 })];
const kept = preserveLinked(snapPlain, liveLinked);
check(kept[0].linked === true, "preserve live linked onto a snapshot edge");
check(kept[0].linkRefId === 99, "preserve live linkRefId onto a snapshot edge");
const deletedLive = preserveLinked(
  [edge(1, 2, { linkRefId: 4 }), edge(2, 3, { linkRefId: 5 })],
  [edge(1, 2, { linkRefId: 8 })],
);
check(deletedLive[0].linkRefId === 8, "live linkRefId wins over the snapshot");
check(
  deletedLive[1].linkRefId === 5,
  "deleted edges keep the snapshot linkRefId",
);

resetAllHistory();
console.log("boardHistorySnapshot.test.ts ok");
