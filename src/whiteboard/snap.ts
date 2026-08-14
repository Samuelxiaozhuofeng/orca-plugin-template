import type { CardRect } from "./selection";
import type { CanvasView } from "./viewTransform";

export const SNAP_SCREEN_PX = 6;
export const MAX_GUIDES_PER_AXIS = 2;

export type Guide = { axis: "x" | "y"; at: number };

export type SnapResult = {
  dx: number;
  dy: number;
  guides: Guide[];
};

type EdgeSet = {
  v: number[];
  h: number[];
};

function edges(box: CardRect): EdgeSet {
  return {
    v: [box.x, box.x + box.w / 2, box.x + box.w],
    h: [box.y, box.y + box.h / 2, box.y + box.h],
  };
}

function pickDelta(
  moving: number[],
  others: readonly CardRect[],
  which: "v" | "h",
  threshold: number,
): { delta: number; lines: number[] } {
  let bestAbs = threshold + 1;
  let bestDelta = 0;
  const hits: { delta: number; line: number }[] = [];

  for (const other of others) {
    const lines = edges(other)[which];
    for (const move of moving) {
      for (const line of lines) {
        const delta = line - move;
        const abs = Math.abs(delta);
        if (abs > threshold) continue;
        hits.push({ delta, line });
        if (abs < bestAbs) {
          bestAbs = abs;
          bestDelta = delta;
        }
      }
    }
  }

  if (bestAbs > threshold) return { delta: 0, lines: [] };

  const aligned = new Set<number>();
  for (const hit of hits) {
    if (Math.abs(hit.delta - bestDelta) <= 0.51) aligned.add(hit.line);
  }
  return { delta: bestDelta, lines: [...aligned] };
}

function nearestLines(
  lines: readonly number[],
  prefer: number,
  limit: number,
): number[] {
  const unique = [...new Set(lines.map((value) => Math.round(value * 100) / 100))];
  unique.sort((a, b) => Math.abs(a - prefer) - Math.abs(b - prefer));
  return unique.slice(0, limit);
}

export function computeSnap(
  moving: CardRect,
  others: readonly CardRect[],
  scale: number,
  enabled: boolean,
): SnapResult {
  if (!enabled || others.length === 0) {
    return { dx: 0, dy: 0, guides: [] };
  }
  const safeScale = scale === 0 ? 1 : scale;
  const threshold = SNAP_SCREEN_PX / safeScale;
  const movingEdges = edges(moving);
  const x = pickDelta(movingEdges.v, others, "v", threshold);
  const y = pickDelta(movingEdges.h, others, "h", threshold);
  const cx = moving.x + moving.w / 2 + x.delta;
  const cy = moving.y + moving.h / 2 + y.delta;
  const guides: Guide[] = [
    ...nearestLines(x.lines, cx, MAX_GUIDES_PER_AXIS).map((at) => ({
      axis: "x" as const,
      at,
    })),
    ...nearestLines(y.lines, cy, MAX_GUIDES_PER_AXIS).map((at) => ({
      axis: "y" as const,
      at,
    })),
  ];
  return { dx: x.delta, dy: y.delta, guides };
}

export function paintGuides(
  layer: HTMLElement | null,
  guides: readonly Guide[],
  view: CanvasView,
): void {
  if (layer == null) return;
  layer.replaceChildren();
  for (const guide of guides) {
    const el = document.createElement("div");
    el.className = `owb-guide owb-guide-${guide.axis}`;
    if (guide.axis === "x") {
      el.style.left = `${guide.at * view.scale + view.x}px`;
    } else {
      el.style.top = `${guide.at * view.scale + view.y}px`;
    }
    layer.appendChild(el);
  }
}

export function clearGuides(layer: HTMLElement | null): void {
  layer?.replaceChildren();
}
