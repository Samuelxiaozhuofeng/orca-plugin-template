import {
  ensureBoardSession,
  resetBoardSessions,
  sessionCanAcceptCards,
} from "./boardSession.ts";
import type { WhiteboardCard } from "./cards.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function card(blockId: number, x = 0): WhiteboardCard {
  return { blockId, kind: "block", x, y: 0, w: 240, h: 160 };
}

resetBoardSessions();

check(
  sessionCanAcceptCards(undefined) === false,
  "no session → cannot append via session",
);

const session = ensureBoardSession(
  501,
  [card(7, 40)],
  [],
  [],
  false,
  false,
  true,
);
check(
  sessionCanAcceptCards(session) === true,
  "hydrated unprotected session can accept cards",
);
check(session.cards[0]?.blockId === 7, "session still holds the live cards");

session.protect = true;
check(
  sessionCanAcceptCards(session) === false,
  "protected session is not a write target",
);
session.protect = false;

const unread = ensureBoardSession(502, [], [], [], false, false, false);
check(
  sessionCanAcceptCards(unread) === false,
  "unhydrated session is not a write target",
);

resetBoardSessions();
console.log("addToBoardSession.test.ts ok");
