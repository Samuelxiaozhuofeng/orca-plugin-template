import type { DbId } from "../orca.d.ts";
import { clampScale } from "./layout.ts";
import type { CanvasView } from "./viewTransform.ts";

async function pluginName(): Promise<string> {
  const { whiteboardPluginName } = await import("./settings.ts");
  return whiteboardPluginName();
}

export const VIEW_MEMORY_DEBOUNCE_MS = 300;

type PendingView = {
  timer: number;
  view: CanvasView;
};

const pending = new Map<DbId, PendingView>();
const lastWritten = new Map<DbId, string>();

export function viewMemoryKey(boardId: DbId): string {
  return `view:${boardId}`;
}

/**
 * Accept a stored viewport, or null when the value is not usable.
 * Finite scale outside the legal range is clamped, not rejected.
 */
export function parseStoredView(raw: unknown): CanvasView | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const rec = raw as Record<string, unknown>;
  const x = rec.x;
  const y = rec.y;
  const scale = rec.scale;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof scale !== "number"
  ) {
    return null;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(scale)) {
    return null;
  }
  return { x, y, scale: clampScale(scale) };
}

function decodeStoredView(raw: unknown): CanvasView | null {
  if (typeof raw === "string") {
    try {
      return parseStoredView(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  }
  return parseStoredView(raw);
}

function payloadFor(view: CanvasView): string | null {
  const parsed = parseStoredView(view);
  if (parsed == null) return null;
  return JSON.stringify(parsed);
}

async function persistView(boardId: DbId, view: CanvasView): Promise<void> {
  const name = await pluginName();
  if (!name) return;
  const payload = payloadFor(view);
  if (payload == null) return;
  if (lastWritten.get(boardId) === payload) return;
  try {
    await orca.plugins.setData(name, viewMemoryKey(boardId), payload);
    lastWritten.set(boardId, payload);
  } catch {
    // Storage is best-effort; a later gesture will try again.
  }
}

export async function loadRememberedView(
  boardId: DbId,
): Promise<CanvasView | null> {
  const name = await pluginName();
  if (!name) return null;
  try {
    const raw = await orca.plugins.getData(name, viewMemoryKey(boardId));
    const parsed = decodeStoredView(raw);
    if (parsed != null) lastWritten.set(boardId, JSON.stringify(parsed));
    return parsed;
  } catch {
    return null;
  }
}

export function scheduleRememberedView(
  boardId: DbId,
  view: CanvasView,
): void {
  const prev = pending.get(boardId);
  if (prev != null) window.clearTimeout(prev.timer);
  const timer = window.setTimeout(() => {
    pending.delete(boardId);
    void persistView(boardId, view);
  }, VIEW_MEMORY_DEBOUNCE_MS);
  pending.set(boardId, { timer, view });
}

export function flushRememberedView(boardId: DbId): void {
  const prev = pending.get(boardId);
  if (prev == null) return;
  window.clearTimeout(prev.timer);
  pending.delete(boardId);
  void persistView(boardId, prev.view);
}
