import {
  EDITOR_COVER_MAX_MS,
  EDITOR_COVER_QUIET_FRAMES,
  shouldLiftEditorCover,
} from "./editorCover.ts";

function check(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

check(EDITOR_COVER_QUIET_FRAMES === 2, "quiet frames constant is 2");
check(EDITOR_COVER_MAX_MS === 600, "cover max ms constant is 600");

// 1. Lines not enough, not quiet, not timed out -> false
check(
  shouldLiftEditorCover({
    editorLines: 5,
    coveredLines: 10,
    quietFrames: 0,
    sawChange: false,
  }) === false,
  "lines not enough, not quiet, not timed out",
);

// 2. editorLines >= coveredLines and coveredLines > 0 -> true (even with quiet=0)
check(
  shouldLiftEditorCover({
    editorLines: 10,
    coveredLines: 10,
    quietFrames: 0,
    sawChange: false,
  }) === true,
  "covered lines reached even with quiet=0",
);
check(
  shouldLiftEditorCover({
    editorLines: 15,
    coveredLines: 10,
    quietFrames: 0,
    sawChange: false,
  }) === true,
  "editor lines exceeding covered lines lifts cover",
);

// 3. coveredLines === 0 && editorLines === 0 -> false (prohibit 0>=0 lifting immediately)
check(
  shouldLiftEditorCover({
    editorLines: 0,
    coveredLines: 0,
    quietFrames: 0,
    sawChange: false,
  }) === false,
  "coveredLines 0 and editorLines 0 does not lift immediately",
);

// 4. sawChange && quietFrames >= 2 -> true
check(
  shouldLiftEditorCover({
    editorLines: 5,
    coveredLines: 10,
    quietFrames: 2,
    sawChange: true,
  }) === true,
  "sawChange with 2 quiet frames lifts cover",
);
check(
  shouldLiftEditorCover({
    editorLines: 5,
    coveredLines: 10,
    quietFrames: 3,
    sawChange: true,
  }) === true,
  "sawChange with more than 2 quiet frames lifts cover",
);

// 5. quietFrames >= 2 && sawChange === false -> false
check(
  shouldLiftEditorCover({
    editorLines: 5,
    coveredLines: 10,
    quietFrames: 2,
    sawChange: false,
  }) === false,
  "quiet frames without sawChange does not lift cover",
);

// 6. sawChange && quietFrames === 1 -> false
check(
  shouldLiftEditorCover({
    editorLines: 5,
    coveredLines: 10,
    quietFrames: 1,
    sawChange: true,
  }) === false,
  "sawChange with only 1 quiet frame does not lift cover",
);

// 7. elapsedMs >= 600 -> true
check(
  shouldLiftEditorCover({
    editorLines: 0,
    coveredLines: 10,
    quietFrames: 0,
    sawChange: false,
    elapsedMs: 600,
  }) === true,
  "elapsedMs >= 600 lifts cover as fallback",
);
check(
  shouldLiftEditorCover({
    editorLines: 0,
    coveredLines: 10,
    quietFrames: 0,
    sawChange: false,
    elapsedMs: 650,
  }) === true,
  "elapsedMs > 600 lifts cover as fallback",
);

// 8. elapsedMs === 599 and other conditions not met -> false
check(
  shouldLiftEditorCover({
    editorLines: 0,
    coveredLines: 10,
    quietFrames: 0,
    sawChange: false,
    elapsedMs: 599,
  }) === false,
  "elapsedMs 599 does not trigger fallback",
);

// 9. editorLines === 95, coveredLines === 96 -> false
check(
  shouldLiftEditorCover({
    editorLines: 95,
    coveredLines: 96,
    quietFrames: 0,
    sawChange: false,
  }) === false,
  "editorLines 95 vs coveredLines 96 does not lift",
);

// 10. editorLines === 96, coveredLines === 96 -> true
check(
  shouldLiftEditorCover({
    editorLines: 96,
    coveredLines: 96,
    quietFrames: 0,
    sawChange: false,
  }) === true,
  "editorLines 96 vs coveredLines 96 lifts cover",
);

console.log("editorCover.test.ts ok");
