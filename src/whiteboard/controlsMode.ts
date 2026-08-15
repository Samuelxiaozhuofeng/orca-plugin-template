export type ControlsMode = "mouse" | "trackpad";

/** Maps a stored `mouseScheme` value (including pre-rename ones) to a mode. */
export function migrateControlsMode(raw: unknown): ControlsMode {
  if (raw === "rightDrag" || raw === "mouse") return "mouse";
  if (raw === "standard" || raw === "trackpad") return "trackpad";
  return "mouse";
}

export function controlsModeFromSettings(
  raw: Record<string, unknown> | undefined,
): ControlsMode {
  return migrateControlsMode(raw?.mouseScheme);
}
