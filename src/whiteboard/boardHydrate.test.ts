import { applyCardEcho, applyEdgeEcho } from "./boardPersistEcho.ts";
import { commitCardsOn, patchCardsOn } from "./boardPersistQueue.ts";
import {
  ensureBoardSession,
  resetBoardSessions,
} from "./boardSession.ts";
import type { WhiteboardCard } from "./cards.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function card(blockId: number): WhiteboardCard {
  return { blockId, kind: "block", x: 0, y: 0, w: 240, h: 160 };
}

resetBoardSessions();

const unread = ensureBoardSession(101, [], [], [], false, false, false);
check(unread.hydrated === false, "missing board block does not hydrate a session");

const refused = await commitCardsOn(unread, [card(99)]);
check(refused === false, "commitCards is refused before the board is loaded");
check(unread.cards.length === 0, "refused commit does not replace cards with the payload");

unread.cards = [card(42)];
applyCardEcho(unread, []);
check(
  unread.cards.length === 1 && unread.cards[0].blockId === 42,
  "empty card echo does not wipe a board that has never been read",
);
applyEdgeEcho(unread, []);
check(unread.edges.length === 0, "empty edge echo is ignored on an unread board");

patchCardsOn(unread, [{ blockId: 42, patch: { x: 88 } }]);
check(unread.cards[0].x === 0, "patchCards is refused before the board is loaded");

ensureBoardSession(101, [card(7)], [], [], false, false, true);
check(unread.hydrated === true, "the first successful read hydrates the session");
check(unread.cards[0].blockId === 7, "the first successful read becomes the local baseline");

applyCardEcho(unread, []);
check(
  unread.cards.length === 0,
  "empty echo after a successful read is allowed (the board really is empty)",
);

resetBoardSessions();
console.log("boardHydrate.test.ts ok");
