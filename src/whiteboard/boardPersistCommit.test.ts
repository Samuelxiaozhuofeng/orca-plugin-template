import { rearmSkippedLanes } from "./boardPersistCommit.ts";
import type { WhiteboardArea } from "./areas.ts";
import type { WhiteboardCard } from "./cards.ts";
import type { WhiteboardEdge } from "./edges.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function card(blockId: number, x = 0): WhiteboardCard {
  return { blockId, kind: "block", x, y: 0, w: 240, h: 160 };
}

function edge(from: number, to: number): WhiteboardEdge {
  return { id: `${from}-${to}-1`, from, to, arrow: "end" };
}

function area(id: string): WhiteboardArea {
  return { id, x: 0, y: 0, w: 200, h: 160, name: "Section" };
}

const snapshotCards = [card(1, 10)];
const snapshotEdges = [edge(1, 2)];
const snapshotAreas = [area("area-1")];

const empty = {
  cardPending: null as WhiteboardCard[] | null,
  edgePending: null as WhiteboardEdge[] | null,
  areaPending: null as WhiteboardArea[] | null,
  cardDirty: false,
  edgeDirty: false,
  areaDirty: false,
};

const allEmpty = { ...empty };
rearmSkippedLanes(allEmpty, {
  cards: snapshotCards,
  edges: snapshotEdges,
  areas: snapshotAreas,
});
check(allEmpty.cardPending === snapshotCards, "empty card lane takes snapshot");
check(allEmpty.edgePending === snapshotEdges, "empty edge lane takes snapshot");
check(allEmpty.areaPending === snapshotAreas, "empty area lane takes snapshot");
check(allEmpty.cardDirty && allEmpty.edgeDirty && allEmpty.areaDirty, "rearmed lanes are dirty");

const newerCards = [card(1, 99)];
const cardPreempted = {
  ...empty,
  cardPending: newerCards,
  cardDirty: true,
};
rearmSkippedLanes(cardPreempted, {
  cards: snapshotCards,
  edges: snapshotEdges,
  areas: snapshotAreas,
});
check(
  cardPreempted.cardPending === newerCards,
  "newer card pending is kept",
);
check(
  cardPreempted.edgePending === snapshotEdges,
  "skipped edges are rearmed when only cards were pending",
);
check(
  cardPreempted.areaPending === snapshotAreas,
  "skipped areas are rearmed when only cards were pending",
);

const cardsAndAreas = {
  ...empty,
  cardPending: newerCards,
  cardDirty: true,
};
rearmSkippedLanes(cardsAndAreas, {
  cards: snapshotCards,
  areas: snapshotAreas,
});
check(
  cardsAndAreas.edgePending == null,
  "cards+areas rearm does not touch the edge lane",
);
check(
  cardsAndAreas.areaPending === snapshotAreas,
  "cards+areas rearm restores skipped areas",
);
check(
  cardsAndAreas.cardPending === newerCards,
  "cards+areas rearm keeps newer cards",
);

console.log("boardPersistCommit.test.ts ok");
