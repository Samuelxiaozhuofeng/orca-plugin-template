import { decideCardDragEnd } from "./cardDragEnd.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const moves = [{ blockId: 1, x: 10, y: 20 }];

check(
  decideCardDragEnd({
    dragged: false,
    armedTarget: 9,
    altKey: false,
    canDrop: true,
    moves,
  }).kind === "idle",
  "click is not a drop",
);

const alt = decideCardDragEnd({
  dragged: true,
  armedTarget: 9,
  altKey: true,
  canDrop: true,
  moves,
});
check(alt.kind === "move", "Alt disables drop");
if (alt.kind === "move") {
  check(alt.moves === moves, "Alt keeps the regular move");
}

const unarmed = decideCardDragEnd({
  dragged: true,
  armedTarget: null,
  altKey: false,
  canDrop: true,
  moves,
});
check(unarmed.kind === "move", "no armed target → regular move");

const noHandler = decideCardDragEnd({
  dragged: true,
  armedTarget: 9,
  altKey: false,
  canDrop: false,
  moves,
});
check(noHandler.kind === "move", "no drop handler → regular move");

const drop = decideCardDragEnd({
  dragged: true,
  armedTarget: 9,
  altKey: false,
  canDrop: true,
  moves,
});
check(drop.kind === "try-drop", "armed hover at mouseup is a drop");
if (drop.kind === "try-drop") {
  check(drop.target === 9, "drop target is the armed id");
  check(drop.movesIfUnhandled === moves, "unhandled drop can fall back to move");
}

console.log("cardDragEnd tests passed");
