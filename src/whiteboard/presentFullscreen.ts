export type FullscreenMode = "native" | "cover";

/** Tries the native fullscreen API first; falls back to "cover" (a fixed,
 *  full-window overlay) when it is unavailable or rejected. Never throws. */
export async function enterPresentFullscreen(
  el: HTMLElement | null,
): Promise<FullscreenMode> {
  if (el == null || typeof el.requestFullscreen !== "function") {
    return "cover";
  }
  try {
    await el.requestFullscreen();
    return "native";
  } catch {
    return "cover";
  }
}

/** Undoes whatever `enterPresentFullscreen` did. Never throws. */
export async function exitPresentFullscreen(mode: FullscreenMode): Promise<void> {
  if (mode !== "native") return;
  if (
    typeof document === "undefined" ||
    document.fullscreenElement == null ||
    typeof document.exitFullscreen !== "function"
  ) {
    return;
  }
  try {
    await document.exitFullscreen();
  } catch {
    // Ignore errors during exit (e.g. document already deactivated).
  }
}

/** Fires when the browser leaves fullscreen on its own (the user hit Esc or F11).
 *  Returns an unsubscribe function. */
export function onFullscreenExit(cb: () => void): () => void {
  if (
    typeof document === "undefined" ||
    typeof document.addEventListener !== "function"
  ) {
    return () => {};
  }
  const handler = () => {
    if (document.fullscreenElement == null) {
      cb();
    }
  };
  document.addEventListener("fullscreenchange", handler);
  return () => {
    document.removeEventListener("fullscreenchange", handler);
  };
}
