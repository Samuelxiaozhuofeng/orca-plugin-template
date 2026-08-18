import type { Block, DbId } from "../orca.d.ts";
import { edgeSourceBlock, type WhiteboardEdge } from "./edges";
import {
  addLinkRefId,
  createPropertyRef,
  enqueueBlock,
  findExistingEdgeLink,
  linkRefIdsEqual,
  readEdgeLinkBackPropIds,
  removeLinkRefId,
  writeEdgeBackLinkProp,
} from "./edgeLink";
import { cacheBlockList, fetchBlock } from "./newCard";

const { useEffect, useRef } = window.React;

/**
 * Creates a reverse property ref on the edge's target note pointing back to
 * the source note, recording the refId in the target's `whiteboard.linkBack`
 * property array.
 *
 * Runs strictly in the target note's serialization lane.
 */
export async function linkEdgeBackByProperty(
  edge: WhiteboardEdge,
): Promise<DbId | undefined> {
  const targetId = edge.to;
  const sourceId = edgeSourceBlock(edge);
  return enqueueBlock(targetId, async () => {
    const loaded = (await orca.invokeBackend(
      "get-block",
      targetId,
    )) as Block | null;
    if (loaded == null) return undefined;
    cacheBlockList([loaded]);
    const target = loaded;
    const current = readEdgeLinkBackPropIds(target);
    const existing = findExistingEdgeLink(target.refs ?? [], current, sourceId);
    if (existing != null) return existing;

    const alias = edge.label?.trim() ?? "";
    const refId = await createPropertyRef(targetId, sourceId, alias);
    const fresh = await fetchBlock(targetId);
    const latest = readEdgeLinkBackPropIds(fresh);
    const next = addLinkRefId(latest, refId);
    if (linkRefIdsEqual(latest, next)) return refId;
    try {
      await writeEdgeBackLinkProp(targetId, next, sourceId);
    } catch (error) {
      try {
        await writeEdgeBackLinkProp(targetId, latest, sourceId);
      } catch (recycleError) {
        console.error(
          "[whiteboard] failed to recycle orphan property back-ref",
          recycleError,
        );
      }
      throw error;
    }
    return refId;
  });
}

/**
 * Removes the reverse property ref from the target note's `whiteboard.linkBack`
 * property array.
 *
 * Runs in the target note's lane. If the target note has already been deleted
 * from the outline, this silently no-ops.
 */
export async function unlinkEdgeBackByProperty(
  edge: WhiteboardEdge,
): Promise<void> {
  const targetId = edge.to;
  const sourceId = edgeSourceBlock(edge);
  await enqueueBlock(targetId, async () => {
    const loaded = (await orca.invokeBackend(
      "get-block",
      targetId,
    )) as Block | null;
    if (loaded == null) return;
    cacheBlockList([loaded]);
    const target = loaded;
    const current = readEdgeLinkBackPropIds(target);
    const refId = findExistingEdgeLink(target.refs ?? [], current, sourceId);
    if (refId == null) return;
    const next = removeLinkRefId(current, refId);
    if (linkRefIdsEqual(current, next)) return;
    await writeEdgeBackLinkProp(targetId, next, sourceId);
  });
}

/**
 * Backfills missing back-links for existing arrows that already have a forward
 * property link (`linkRefId != null`).
 *
 * Runs once per board mount when `bidirectionalEdgeLinks` is enabled.
 * Operations are serial and non-blocking. Never touches the board's `edges` prop.
 */
export function useEdgeBackLinkBackfill(
  boardBlockId: DbId | null | undefined,
  edges: readonly WhiteboardEdge[],
  enabled: boolean,
): void {
  const ranForBoardRef = useRef<DbId | null>(null);
  const edgesRef = useRef<readonly WhiteboardEdge[]>(edges);
  edgesRef.current = edges;
  // The board block loads asynchronously, so the first render usually has no
  // edges yet. Counting candidates as a dep lets the pass wait for them.
  const candidateCount = edges.reduce(
    (n: number, edge: WhiteboardEdge) => (edge.linkRefId != null ? n + 1 : n),
    0,
  );

  useEffect(() => {
    if (!enabled || boardBlockId == null) return;
    if (ranForBoardRef.current === boardBlockId) return;

    const candidates = edgesRef.current.filter(
      (edge: WhiteboardEdge) => edge.linkRefId != null,
    );
    // Not latched yet: nothing to backfill means the edges have not arrived.
    if (candidates.length === 0) return;
    ranForBoardRef.current = boardBlockId;

    void (async () => {
      for (const edge of candidates) {
        try {
          await linkEdgeBackByProperty(edge);
        } catch (error) {
          console.error(
            "[whiteboard] failed to backfill edge back-link",
            error,
          );
        }
      }
    })();
  }, [boardBlockId, enabled, candidateCount]);
}
