import {
  planAddToSlides,
  planMoveSlide,
  planRemoveFromSlides,
  slideAreas,
} from "./areaSlides.ts";
import { type WhiteboardArea } from "./areas.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function makeArea(id: string, slide?: number): WhiteboardArea {
  const area: WhiteboardArea = {
    id,
    x: 0,
    y: 0,
    w: 200,
    h: 200,
    name: id,
  };
  if (slide != null) area.slide = slide;
  return area;
}

// 1. slideAreas ignores areas without slide, sorts ascending, and is stable
const unsorted: WhiteboardArea[] = [
  makeArea("a1", 3),
  makeArea("a2"),
  makeArea("a3", 1),
  makeArea("a4", 2),
  makeArea("a5", 2),
  makeArea("a6"),
];
const slidesOnly = slideAreas(unsorted);
check(slidesOnly.length === 4, "slideAreas filters out non-slide areas");
check(
  slidesOnly.map((a) => a.id).join(",") === "a3,a4,a5,a1",
  "slideAreas sorts by slide ascending and keeps stable order for ties",
);

// 2. planAddToSlides: sequential additions yield 1, 2, 3
const initial: WhiteboardArea[] = [
  makeArea("area-1"),
  makeArea("area-2"),
  makeArea("area-3"),
];

const after1 = planAddToSlides(initial, "area-1");
check(after1 != null, "add area-1 to slides");
check(after1![0].slide === 1, "first added slide is 1");
check(after1![1].slide === undefined && !("slide" in after1![1]), "area-2 untouched");
check(after1![2].slide === undefined && !("slide" in after1![2]), "area-3 untouched");

const after2 = planAddToSlides(after1!, "area-2");
check(after2 != null, "add area-2 to slides");
check(after2![0].slide === 1, "area-1 stays 1");
check(after2![1].slide === 2, "area-2 becomes 2");
check(after2![2].slide === undefined && !("slide" in after2![2]), "area-3 untouched");

const after3 = planAddToSlides(after2!, "area-3");
check(after3 != null, "add area-3 to slides");
check(
  after3!.map((a) => a.slide).join(",") === "1,2,3",
  "three consecutive adds give slides 1, 2, 3",
);

// Already in slides -> returns null
check(
  planAddToSlides(after3!, "area-1") == null,
  "adding area already in slides returns null",
);

// Non-existent id -> returns null
check(
  planAddToSlides(after3!, "non-existent") == null,
  "adding non-existent area returns null",
);

// 3. planRemoveFromSlides: removing middle slide renumbers remaining to 1..n without gaps
const removedMiddle = planRemoveFromSlides(after3!, "area-2");
check(removedMiddle != null, "remove area-2 from slides");
check(
  removedMiddle!.find((a) => a.id === "area-1")?.slide === 1,
  "area-1 stays slide 1",
);
const removedArea2 = removedMiddle!.find((a) => a.id === "area-2");
check(
  removedArea2?.slide === undefined && !("slide" in removedArea2!),
  "area-2 slide property is deleted",
);
check(
  removedMiddle!.find((a) => a.id === "area-3")?.slide === 2,
  "area-3 is renumbered from 3 to 2 without holes",
);

// Remove area not in slides -> returns null
check(
  planRemoveFromSlides(initial, "area-1") == null,
  "removing area not in slides returns null",
);

// Remove non-existent id -> returns null
check(
  planRemoveFromSlides(after3!, "non-existent") == null,
  "removing non-existent area returns null",
);

// 4. planMoveSlide: move earlier / later swaps slides; boundary moves return null
// Start with 1, 2, 3
const state123 = after3!;

// Move first earlier (delta = -1) -> null
check(
  planMoveSlide(state123, "area-1", -1) == null,
  "moving first slide earlier returns null",
);

// Move last later (delta = +1) -> null
check(
  planMoveSlide(state123, "area-3", 1) == null,
  "moving last slide later returns null",
);

// Move middle earlier: 2 -> 1, 1 -> 2, 3 stays 3
const moved2Up = planMoveSlide(state123, "area-2", -1);
check(moved2Up != null, "move area-2 earlier");
check(moved2Up!.find((a) => a.id === "area-2")?.slide === 1, "area-2 is now slide 1");
check(moved2Up!.find((a) => a.id === "area-1")?.slide === 2, "area-1 is now slide 2");
check(moved2Up!.find((a) => a.id === "area-3")?.slide === 3, "area-3 is still slide 3");

// Move middle later: 2 -> 3, 3 -> 2, 1 stays 1
const moved2Down = planMoveSlide(state123, "area-2", 1);
check(moved2Down != null, "move area-2 later");
check(moved2Down!.find((a) => a.id === "area-1")?.slide === 1, "area-1 is still slide 1");
check(moved2Down!.find((a) => a.id === "area-3")?.slide === 2, "area-3 is now slide 2");
check(moved2Down!.find((a) => a.id === "area-2")?.slide === 3, "area-2 is now slide 3");

// Move with delta = 0 -> null
check(planMoveSlide(state123, "area-2", 0) == null, "moving with delta 0 returns null");

// Move non-slide area -> null
check(
  planMoveSlide(initial, "area-1", 1) == null,
  "moving non-slide area returns null",
);

// Move non-existent area -> null
check(
  planMoveSlide(state123, "non-existent", 1) == null,
  "moving non-existent area returns null",
);

console.log("areaSlides.test.ts ok");
