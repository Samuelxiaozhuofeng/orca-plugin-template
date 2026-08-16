import { t } from "../libs/l10n";
import { linkEdgeByProperty, unlinkEdgeByProperty } from "./edgeLink";
import type { WhiteboardEdge } from "./edges";
import { linkEdgeToNote } from "./linkEdge";
import { currentWhiteboardSettings } from "./settings";

export type EdgeLinkAction = {
  edge: WhiteboardEdge;
  /** Undo of a deleted property-linked line; always uses the property path. */
  restore: boolean;
};

export type EdgeLinkPlan = {
  /** Previous edges whose property refs must be removed first. */
  unlinks: WhiteboardEdge[];
  /** Next-list edges that should get a note reference after unlinks. */
  links: EdgeLinkAction[];
};

export type EdgeLinkSyncOpts = {
  /**
   * When true, an existing edge whose `from`/`to` changed is treated as the
   * user rehanging this arrow: unlink the old pair, then (if that line
   * already had a property ref and auto-link is on) link the new pair.
   * Undo/redo and card-removal must pass false so leftover remaps from
   * collect/drop do not rewrite notes.
   */
  rebindEndpoints: boolean;
  autoLink: boolean;
};

function endpointsChanged(
  left: WhiteboardEdge,
  right: WhiteboardEdge,
): boolean {
  return left.from !== right.from || left.to !== right.to;
}

/** Pure: which edges to unlink / link. Side effects stay in `syncEdgeLinks`. */
export function planEdgeLinkSync(
  prev: readonly WhiteboardEdge[],
  next: readonly WhiteboardEdge[],
  opts: EdgeLinkSyncOpts,
): EdgeLinkPlan {
  const prevById = new Map(prev.map((edge) => [edge.id, edge]));
  const nextById = new Map(next.map((edge) => [edge.id, edge]));
  const unlinks: WhiteboardEdge[] = [];
  const links: EdgeLinkAction[] = [];

  for (const old of prev) {
    if (old.linkRefId == null) continue;
    const cur = nextById.get(old.id);
    const dropped = cur == null;
    const cleared = cur != null && cur.linkRefId == null;
    const rebound =
      opts.rebindEndpoints && cur != null && endpointsChanged(old, cur);
    if (dropped || cleared || rebound) unlinks.push(old);
  }

  for (const edge of next) {
    if (edge.linked === true) continue;
    const old = prevById.get(edge.id);
    const isNew = old == null;
    if (isNew && edge.linkRefId != null) {
      links.push({ edge, restore: true });
      continue;
    }
    if (isNew && opts.autoLink) {
      links.push({ edge, restore: false });
      continue;
    }
    const rebound =
      opts.rebindEndpoints && old != null && endpointsChanged(old, edge);
    if (rebound && old.linkRefId != null && opts.autoLink) {
      links.push({ edge, restore: false });
    }
  }

  return { unlinks, links };
}

/**
 * Apply note-reference side effects for a new edge list, then return the
 * edges to persist. `null` means an unlink failed — the caller must abort
 * so a line is never removed while its reference stays behind.
 *
 * Collect/drop paths that only *move* edges must not call this: those
 * arrows still exist on the other board.
 *
 * `rebindEndpoints`: only the user's direct line edits (draw / delete /
 * rehang) should pass true. Undo/redo and removing cards pass false.
 */
export async function syncEdgeLinks(
  prev: readonly WhiteboardEdge[],
  next: readonly WhiteboardEdge[],
  rebindEndpoints: boolean,
): Promise<WhiteboardEdge[] | null> {
  const settings = currentWhiteboardSettings();
  const plan = planEdgeLinkSync(prev, next, {
    rebindEndpoints,
    autoLink: settings.autoLinkEdges,
  });

  for (const old of plan.unlinks) {
    try {
      await unlinkEdgeByProperty(old);
    } catch (error) {
      console.error("[whiteboard] unlink edge failed", error);
      orca.notify("error", t("Failed to remove the note reference"));
      return null;
    }
  }

  const unlinkIds = new Set(plan.unlinks.map((edge) => edge.id));
  const linkIds = new Set(plan.links.map((item) => item.edge.id));
  const result: WhiteboardEdge[] = next.map((edge) => {
    const copy = { ...edge };
    if (
      unlinkIds.has(edge.id) &&
      !linkIds.has(edge.id) &&
      copy.linkRefId != null
    ) {
      delete copy.linkRefId;
    }
    return copy;
  });

  for (const action of plan.links) {
    const index = result.findIndex((edge) => edge.id === action.edge.id);
    if (index < 0) continue;
    const edge = result[index];
    try {
      const useChild = !action.restore && settings.edgeLinkMode === "child";
      if (useChild) {
        await linkEdgeToNote(edge);
        const marked = { ...edge, linked: true as const };
        delete marked.linkRefId;
        result[index] = marked;
      } else {
        const refId = await linkEdgeByProperty(edge);
        result[index] = { ...edge, linkRefId: refId };
      }
    } catch (error) {
      console.error("[whiteboard] link edge failed", error);
      orca.notify("error", t("Failed to create a note reference"));
    }
  }

  return result;
}

/** Sync refs, write edges, and put refs back if the write itself fails. */
export async function writeEdgesAfterLinkSync(
  prev: readonly WhiteboardEdge[],
  next: readonly WhiteboardEdge[],
  write: (edges: WhiteboardEdge[]) => Promise<boolean>,
  rebindEndpoints: boolean,
): Promise<boolean> {
  const synced = await syncEdgeLinks(prev, next, rebindEndpoints);
  if (synced == null) return false;
  const ok = await write(synced);
  if (ok) return true;
  try {
    await syncEdgeLinks(synced, prev, rebindEndpoints);
  } catch (error) {
    console.error(
      "[whiteboard] failed to restore note references after save failed",
      error,
    );
  }
  return false;
}
