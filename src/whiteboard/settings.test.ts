import {
  controlsModeFromSettings,
  migrateControlsMode,
} from "./controlsMode.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

check(migrateControlsMode("rightDrag") === "mouse", "rightDrag → mouse");
check(migrateControlsMode("mouse") === "mouse", "mouse stays mouse");
check(migrateControlsMode("standard") === "trackpad", "standard → trackpad");
check(migrateControlsMode("trackpad") === "trackpad", "trackpad stays trackpad");
check(migrateControlsMode("nope") === "mouse", "unknown string → mouse");
check(migrateControlsMode(undefined) === "mouse", "undefined → mouse");
check(migrateControlsMode(null) === "mouse", "null → mouse");
check(migrateControlsMode(1) === "mouse", "number → mouse");
check(migrateControlsMode(true) === "mouse", "boolean → mouse");
check(migrateControlsMode({}) === "mouse", "object → mouse");
check(migrateControlsMode("") === "mouse", "empty string → mouse");

check(
  controlsModeFromSettings({ mouseScheme: "rightDrag" }) === "mouse",
  "read rightDrag",
);
check(
  controlsModeFromSettings({ mouseScheme: "standard" }) === "trackpad",
  "read standard",
);
check(
  controlsModeFromSettings({ mouseScheme: "mouse" }) === "mouse",
  "read mouse",
);
check(
  controlsModeFromSettings({ mouseScheme: "trackpad" }) === "trackpad",
  "read trackpad",
);
check(
  controlsModeFromSettings({ mouseScheme: "legacy" }) === "mouse",
  "read unknown",
);
check(
  controlsModeFromSettings(undefined) === "mouse",
  "read missing settings object",
);
check(
  controlsModeFromSettings({}) === "mouse",
  "read missing mouseScheme",
);
check(
  controlsModeFromSettings({ mouseScheme: 0 }) === "mouse",
  "read dirty non-string",
);

console.log("settings tests passed");
