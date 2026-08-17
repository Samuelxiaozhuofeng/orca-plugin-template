import type { WhiteboardArea } from "./areas.ts";
import {
  buildSlides,
  clampCursor,
  stepCard,
  stepSlide,
  type PresentCard,
  type PresentCursor,
} from "./presentation.ts";

function check(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// 1. buildSlides: ordering, grouping, collapsed areas, filtering
const area1: WhiteboardArea = {
  id: "a1",
  name: "Intro",
  x: 0,
  y: 0,
  w: 500,
  h: 500,
  slide: 1,
};
const area2: WhiteboardArea = {
  id: "a2",
  name: "Details",
  x: 600,
  y: 0,
  w: 500,
  h: 500,
  slide: 2,
};
const areaCollapsed: WhiteboardArea = {
  id: "a3",
  name: "Collapsed",
  x: 1200,
  y: 0,
  w: 500,
  h: 500,
  slide: 3,
  collapsed: true,
};
const areaNoSlide: WhiteboardArea = {
  id: "a4",
  name: "NoSlide",
  x: 1800,
  y: 0,
  w: 500,
  h: 500,
};

// Cards for area 1:
// Row 1: card1 (x=20, y=20, h=40), card2 (x=200, y=30, h=40) -> y diff = 10 < 20 (same row)
// Row 2: card3 (x=100, y=100, h=40) -> y diff from row 1 = 80 >= 20 (new row)
// Row 2: card4 (x=20, y=105, h=40) -> same row as card3, but x is smaller (should come before card3 in row 2)
// Outside: cardOut (x=600, y=20)
const cards: PresentCard[] = [
  { blockId: 102, x: 200, y: 30, w: 100, h: 40 },
  { blockId: 101, x: 20, y: 20, w: 100, h: 40 },
  { blockId: 103, x: 100, y: 100, w: 100, h: 40 },
  { blockId: 104, x: 20, y: 105, w: 100, h: 40 },
  { blockId: 105, x: 650, y: 50, w: 100, h: 40 }, // in area2
  { blockId: 106, x: 1250, y: 50, w: 100, h: 40 }, // in collapsed area3
  { blockId: 999, x: 2000, y: 50, w: 100, h: 40 }, // in areaNoSlide
];

const slides = buildSlides(
  [area2, area1, areaNoSlide, areaCollapsed],
  cards,
);

check(slides.length === 3, "slides length should exclude unslided areas");
check(slides[0].areaId === "a1", "slide 1 should be area1 (slide: 1)");
check(slides[1].areaId === "a2", "slide 2 should be area2 (slide: 2)");
check(slides[2].areaId === "a3", "slide 3 should be area3 (slide: 3)");

// Check reading order for area 1:
// Row 1: card 101 (x=20), card 102 (x=200)
// Row 2: card 104 (x=20), card 103 (x=100)
check(
  JSON.stringify(slides[0].cards.map((c) => c.blockId)) ===
    JSON.stringify([101, 102, 104, 103]),
  "area1 cards should follow reading order (row grouping by y diff, then sorted by x)",
);
check(
  slides[0].cards[0].x === 20 &&
    slides[0].cards[0].y === 20 &&
    slides[0].cards[0].w === 100 &&
    slides[0].cards[0].h === 40,
  "slide card has box dimensions",
);

// Check area 2
check(
  JSON.stringify(slides[1].cards.map((c) => c.blockId)) === JSON.stringify([105]),
  "area2 cards should contain card 105",
);

// Check collapsed area 3 has empty cards
check(
  slides[2].cards.length === 0,
  "collapsed area must have empty cards",
);

// 2. stepSlide
const cur0: PresentCursor = { slideIndex: 0, cardIndex: -1 };
const cur0WithCard: PresentCursor = { slideIndex: 0, cardIndex: 2 };

// Next slide
const cur1 = stepSlide(cur0, slides, 1);
check(cur1.slideIndex === 1 && cur1.cardIndex === -1, "stepSlide 1 from slide 0 moves to slide 1");

// Next slide resets cardIndex
const cur1FromCard = stepSlide(cur0WithCard, slides, 1);
check(cur1FromCard.slideIndex === 1 && cur1FromCard.cardIndex === -1, "stepSlide resets cardIndex to -1");

// Next slide at end stops and returns identical reference
const curEnd: PresentCursor = { slideIndex: 2, cardIndex: -1 };
const curEndNext = stepSlide(curEnd, slides, 1);
check(curEndNext === curEnd, "stepSlide at end returns original cursor reference");

// Prev slide at start stops and returns identical reference
const cur0Prev = stepSlide(cur0, slides, -1);
check(cur0Prev === cur0, "stepSlide at start returns original cursor reference");

// Prev slide moves backward
const curPrev = stepSlide(cur1, slides, -1);
check(curPrev.slideIndex === 0 && curPrev.cardIndex === -1, "stepSlide -1 moves backward");

// Empty slides
check(stepSlide(cur0, [], 1) === cur0, "stepSlide on empty slides returns original cursor");

// 3. stepCard (cycles: -1 → 0 → 1 → … → n-1 → -1)
// area1 has 4 cards: [101, 102, 104, 103] -> indices 0, 1, 2, 3
let cCur: PresentCursor = { slideIndex: 0, cardIndex: -1 };

cCur = stepCard(cCur, slides, 1);
check(cCur.slideIndex === 0 && cCur.cardIndex === 0, "stepCard +1 moves from -1 to 0");

cCur = stepCard(cCur, slides, 1);
check(cCur.slideIndex === 0 && cCur.cardIndex === 1, "stepCard +1 moves from 0 to 1");

cCur = stepCard(cCur, slides, 1);
check(cCur.slideIndex === 0 && cCur.cardIndex === 2, "stepCard +1 moves from 1 to 2");

cCur = stepCard(cCur, slides, 1);
check(cCur.slideIndex === 0 && cCur.cardIndex === 3, "stepCard +1 moves from 2 to 3 (last card)");

// At last card, stepCard +1 wraps back to -1 (whole area)
cCur = stepCard(cCur, slides, 1);
check(cCur.slideIndex === 0 && cCur.cardIndex === -1, "stepCard +1 at last card wraps to -1 (whole area)");

// From -1, stepCard -1 jumps to last card (index 3)
cCur = stepCard(cCur, slides, -1);
check(cCur.slideIndex === 0 && cCur.cardIndex === 3, "stepCard -1 from -1 jumps to last card (3)");

// Step backwards
cCur = stepCard(cCur, slides, -1);
check(cCur.cardIndex === 2, "stepCard -1 moves from 3 to 2");

cCur = stepCard(cCur, slides, -1);
check(cCur.cardIndex === 1, "stepCard -1 moves from 2 to 1");

cCur = stepCard(cCur, slides, -1);
check(cCur.cardIndex === 0, "stepCard -1 moves from 1 to 0");

cCur = stepCard(cCur, slides, -1);
check(cCur.cardIndex === -1, "stepCard -1 moves from 0 to -1 (entire area)");

// At -1, stepCard -1 wraps back to last card (3)
cCur = stepCard(cCur, slides, -1);
check(cCur.cardIndex === 3, "stepCard -1 at -1 wraps to last card (3)");

// Empty cards slide (slide 2 / area 3)
const cCurEmpty: PresentCursor = { slideIndex: 2, cardIndex: -1 };
check(
  stepCard(cCurEmpty, slides, 1) === cCurEmpty,
  "stepCard on slide with no cards returns original reference",
);

// 4. clampCursor
check(clampCursor(cur0, []) === null, "clampCursor on empty slides returns null");

const outOfBoundsSlide: PresentCursor = { slideIndex: 5, cardIndex: 2 };
const clampedSlide = clampCursor(outOfBoundsSlide, slides);
check(
  clampedSlide?.slideIndex === 2 && clampedSlide?.cardIndex === -1,
  "clampCursor clamps slideIndex to last slide and cardIndex to -1 on empty slide",
);

const outOfBoundsCard: PresentCursor = { slideIndex: 0, cardIndex: 10 };
const clampedCard = clampCursor(outOfBoundsCard, slides);
check(
  clampedCard?.slideIndex === 0 && clampedCard?.cardIndex === 3,
  "clampCursor clamps cardIndex to last card of that slide",
);

const validCursor: PresentCursor = { slideIndex: 0, cardIndex: 1 };
check(
  clampCursor(validCursor, slides) === validCursor,
  "clampCursor preserves reference for valid cursor",
);

console.log("presentation.test.ts ok");
