import type { DbId } from "../orca.d.ts";
import { canRedo, canUndo } from "./boardHistory";
import {
  handleWhiteboardKey,
  isWhiteboardShortcutTarget,
  type WhiteboardKeyActions,
} from "./canvasKeys";
import type { CanvasFocusApi } from "./cardFocus";
import { planColorPatches } from "./cardBatch";
import type { WhiteboardCard } from "./data";
import type { WhiteboardEdge } from "./edges";
import { nextZoomScale, scaleViewAround } from "./fitView";
import type { CardPatchEntry, PatchCardsFn } from "./useCanvasPointer";
import type { CanvasView } from "./viewTransform";

const { useEffect, useRef } = window.React;

export function useCanvasKeys(opts: {
  panelId: string;
  boardBlockId: DbId;
  searchOpen: boolean;
  viewportRef: { current: HTMLElement | null };
  editingRef: { current: DbId | null };
  selectedRef: { current: DbId[] };
  selectedEdgeRef: { current: string | null };
  cardsRef: { current: WhiteboardCard[] };
  edgesRef: { current: WhiteboardEdge[] };
  liveViewRef: { current: CanvasView };
  viewportSize: { width: number; height: number };
  focusApiRef: { current: CanvasFocusApi | null };
  hostUndoOnceRef: { current: boolean };
  onPatchCards: PatchCardsFn;
  onRemoveCards: (ids: DbId[]) => Promise<boolean>;
  onCommitEdges: (next: WhiteboardEdge[]) => Promise<boolean>;
  onUndo: () => void;
  onRedo: () => void;
  onExitDrawArea: () => void;
  selectCards: (ids: DbId[]) => void;
  selectArea: (id: string | null) => void;
  deleteSelectedArea: () => boolean;
  setSelectedEdge: (id: string | null) => void;
  endEdit: () => void;
  onViewChange: (view: CanvasView) => void;
  present?: WhiteboardKeyActions["present"];
}): void {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const ctx = optsRef.current;
      if (event.key === "Escape" && ctx.editingRef.current != null) {
        ctx.endEdit();
        return;
      }
      if (
        !isWhiteboardShortcutTarget(event, {
          panelId: ctx.panelId,
          editing: ctx.editingRef.current != null,
          viewport: ctx.viewportRef.current,
          searchOpen: ctx.searchOpen,
        })
      ) {
        return;
      }
      handleWhiteboardKey(
        event,
        {
          present: ctx.present,
          nudge: (dx, dy) => {
            const ids = new Set<DbId>(ctx.selectedRef.current);
            if (ids.size === 0) return;
            const entries: CardPatchEntry[] = [];
            ctx.cardsRef.current = ctx.cardsRef.current.map(
              (card: WhiteboardCard) => {
                if (!ids.has(card.blockId)) return card;
                const next = { ...card, x: card.x + dx, y: card.y + dy };
                entries.push({
                  blockId: card.blockId,
                  patch: { x: next.x, y: next.y },
                });
                return next;
              },
            );
            ctx.onPatchCards(entries);
          },
          selectAll: () => {
            ctx.selectCards(
              ctx.cardsRef.current.map((card: WhiteboardCard) => card.blockId),
            );
          },
          escape: () => {
            ctx.selectCards([]);
            ctx.selectArea(null);
            ctx.onExitDrawArea();
          },
          remove: () => {
            const edgeId = ctx.selectedEdgeRef.current;
            if (edgeId != null) {
              void ctx
                .onCommitEdges(
                  ctx.edgesRef.current.filter(
                    (edge: WhiteboardEdge) => edge.id !== edgeId,
                  ),
                )
                .then((ok: boolean) => {
                  if (ok) ctx.setSelectedEdge(null);
                });
              return;
            }
            if (ctx.deleteSelectedArea()) return;
            const ids = ctx.selectedRef.current;
            if (ids.length === 0) return;
            void ctx.onRemoveCards(ids).then((ok: boolean) => {
              if (ok) ctx.selectCards([]);
            });
          },
          undo: ctx.onUndo,
          redo: ctx.onRedo,
          zoomIn: () => zoomBy(ctx, 1),
          zoomOut: () => zoomBy(ctx, -1),
          fit: () => {
            const ids = ctx.selectedRef.current;
            if (ids.length > 0) {
              const set = new Set(ids);
              const boxes = ctx.cardsRef.current.filter(
                (card: WhiteboardCard) => set.has(card.blockId),
              );
              ctx.focusApiRef.current?.fitBoxes(boxes);
              return;
            }
            ctx.focusApiRef.current?.fitAll();
          },
          color: (id) => {
            const patches = planColorPatches(
              ctx.cardsRef.current,
              new Set(ctx.selectedRef.current),
              id,
            );
            if (patches.length === 0) return;
            ctx.onPatchCards(patches);
          },
        },
        {
          canUndo: canUndo(ctx.boardBlockId),
          canRedo: canRedo(ctx.boardBlockId),
          takeHostUndo: () => {
            if (!ctx.hostUndoOnceRef.current) return false;
            ctx.hostUndoOnceRef.current = false;
            return true;
          },
        },
      );
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [opts.boardBlockId, opts.panelId, opts.searchOpen]);
}

function zoomBy(
  ctx: {
    liveViewRef: { current: CanvasView };
    viewportSize: { width: number; height: number };
    viewportRef: { current: HTMLElement | null };
    onViewChange: (view: CanvasView) => void;
  },
  direction: 1 | -1,
): void {
  const current = ctx.liveViewRef.current;
  const width = ctx.viewportRef.current?.clientWidth ?? ctx.viewportSize.width;
  const height =
    ctx.viewportRef.current?.clientHeight ?? ctx.viewportSize.height;
  ctx.onViewChange(
    scaleViewAround(current, nextZoomScale(current.scale, direction), {
      x: width / 2,
      y: height / 2,
    }),
  );
}
