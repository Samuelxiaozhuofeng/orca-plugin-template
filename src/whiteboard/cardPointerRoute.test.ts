import {
  routeCardPointer,
  type CardPointerInput,
} from "./cardPointerRoute.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function route(
  patch: Partial<CardPointerInput> &
    Pick<CardPointerInput, "controlsMode" | "zone">,
): ReturnType<typeof routeCardPointer> {
  return routeCardPointer({
    button: 0,
    spaceHeld: false,
    editing: false,
    ...patch,
  });
}

check(
  route({ controlsMode: "mouse", zone: "header" }).kind === "moveCard",
  "mouse + header → move card",
);
check(
  (route({ controlsMode: "mouse", zone: "header" }) as { enterEditOnClick: boolean })
    .enterEditOnClick === false,
  "mouse + header click does not enter edit",
);

check(
  route({ controlsMode: "mouse", zone: "body" }).kind === "textSelect",
  "mouse + body → native text select",
);

check(
  route({ controlsMode: "mouse", zone: "other" }).kind === "moveCard",
  "mouse + card chrome → move card",
);

const trackpadBody = route({ controlsMode: "trackpad", zone: "body" });
check(trackpadBody.kind === "moveCard", "trackpad + body → move card");
check(
  trackpadBody.kind === "moveCard" && trackpadBody.enterEditOnClick === true,
  "trackpad + body click may enter edit",
);

const trackpadHeader = route({ controlsMode: "trackpad", zone: "header" });
check(
  trackpadHeader.kind === "moveCard" && trackpadHeader.enterEditOnClick === true,
  "trackpad + header still uses the move path",
);

check(
  route({ controlsMode: "mouse", zone: "body", editing: true }).kind ===
    "ignore",
  "mouse + body while editing → leave it to the editor",
);
check(
  route({ controlsMode: "trackpad", zone: "body", editing: true }).kind ===
    "ignore",
  "trackpad + body while editing → leave it to the editor",
);
check(
  route({ controlsMode: "mouse", zone: "header", editing: true }).kind ===
    "moveCard",
  "header drag still moves while that card is being edited",
);

check(
  route({ controlsMode: "mouse", zone: "body", button: 1 }).kind === "pan",
  "middle button pans",
);
check(
  route({
    controlsMode: "trackpad",
    zone: "body",
    button: 0,
    spaceHeld: true,
  }).kind === "pan",
  "space + left pans in either mode",
);

check(
  route({ controlsMode: "mouse", zone: "body", button: 2 }).kind === "rightCard",
  "mouse right-press starts the right-button session",
);
check(
  route({ controlsMode: "trackpad", zone: "header", button: 2 }).kind ===
    "ignore",
  "trackpad right-press leaves the native menu alone",
);
check(
  route({ controlsMode: "mouse", zone: "body", button: 3 }).kind === "ignore",
  "other buttons are ignored",
);

for (const keys of [
  { shiftKey: true },
  { altKey: true },
  { metaKey: true },
  { ctrlKey: true },
  { shiftKey: true, ctrlKey: true },
] as const) {
  check(
    route({ controlsMode: "mouse", zone: "body", ...keys }).kind ===
      "textSelect",
    `mouse body stays text-select with ${JSON.stringify(keys)}`,
  );
  check(
    route({ controlsMode: "trackpad", zone: "body", ...keys }).kind ===
      "moveCard",
    `trackpad body stays move-card with ${JSON.stringify(keys)}`,
  );
}

console.log("cardPointerRoute tests passed");
