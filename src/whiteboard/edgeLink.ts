import type { Block, BlockRef, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  linkEdgeBackByProperty,
  unlinkEdgeBackByProperty,
} from "./edgeBackLink";
import { edgeSourceBlock, type WhiteboardEdge } from "./edges";
import { cacheBlockList, fetchBlock } from "./newCard";
import { cacheReturnedBlocks } from "./noteWrite";
import { currentWhiteboardSettings } from "./settings";

export { edgeSourceBlock };

/** Property that holds this plugin's forward arrow references. Type is BlockRefs (2). */
export const EDGE_LINK_PROP = "whiteboard.link";

/** Property that holds this plugin's reverse arrow references. Type is BlockRefs (2). */
export const EDGE_LINK_BACK_PROP = "whiteboard.linkBack";

/** `RefType.Property` — not an inline / alias reference. */
export const REF_TYPE_PROPERTY = 2;

/** `PropType.BlockRefs`. */
export const PROP_TYPE_BLOCK_REFS = 2;

export function parseLinkRefIds(value: unknown): DbId[] {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const out: DbId[] = [];
  const seen = new Set<DbId>();
  for (const item of raw) {
    if (typeof item !== "number" || !Number.isFinite(item) || seen.has(item)) {
      continue;
    }
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function addLinkRefId(ids: readonly DbId[], refId: DbId): DbId[] {
  if (ids.includes(refId)) return [...ids];
  return [...ids, refId];
}

export function removeLinkRefId(ids: readonly DbId[], refId: DbId): DbId[] {
  return ids.filter((id) => id !== refId);
}

export function linkRefIdsEqual(
  left: readonly DbId[],
  right: readonly DbId[],
): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

/**
 * A plugin-owned property ref to `toId`: type is property, the id sits in
 * this plugin's property array, and the target matches.
 */
export function findExistingEdgeLink(
  refs: readonly Pick<BlockRef, "id" | "to" | "type">[],
  propIds: readonly DbId[],
  toId: DbId,
): DbId | undefined {
  const inProp = new Set(propIds);
  for (const ref of refs) {
    if (
      ref.type === REF_TYPE_PROPERTY &&
      inProp.has(ref.id) &&
      ref.to === toId
    ) {
      return ref.id;
    }
  }
  return undefined;
}

export function isPluginPropertyRef(
  ref: Pick<BlockRef, "id" | "type">,
  propIds: readonly DbId[],
): boolean {
  return ref.type === REF_TYPE_PROPERTY && propIds.includes(ref.id);
}

export function readPropertyRefIds(
  block:
    | { properties?: readonly { name: string; value?: unknown }[] }
    | undefined,
  propName: string,
): DbId[] {
  const prop = block?.properties?.find((item) => item.name === propName);
  if (prop == null) return [];
  return parseLinkRefIds(prop.value);
}

export function readEdgeLinkPropIds(
  block:
    | { properties?: readonly { name: string; value?: unknown }[] }
    | undefined,
): DbId[] {
  return readPropertyRefIds(block, EDGE_LINK_PROP);
}

export function readEdgeLinkBackPropIds(
  block:
    | { properties?: readonly { name: string; value?: unknown }[] }
    | undefined,
): DbId[] {
  return readPropertyRefIds(block, EDGE_LINK_BACK_PROP);
}

/** True when this line has a note reference (property or the older child block). */
export function edgeHasNoteLink(edge: WhiteboardEdge): boolean {
  return edge.linked === true || edge.linkRefId != null;
}

const lanes = new Map<DbId, Promise<unknown>>();

export function enqueueBlock<T>(blockId: DbId, run: () => Promise<T>): Promise<T> {
  const queued = (lanes.get(blockId) ?? Promise.resolve()).then(run, run);
  const tracked = queued.then(
    () => {},
    () => {},
  );
  lanes.set(blockId, tracked);
  void tracked.then(() => {
    if (lanes.get(blockId) === tracked) lanes.delete(blockId);
  });
  return queued;
}

export async function flushEdgeLinkWrites(): Promise<void> {
  const pending = [...lanes.values()];
  lanes.clear();
  await Promise.all(pending);
}

function cacheWriteResult(result: unknown): void {
  if (!Array.isArray(result)) return;
  if (Array.isArray(result[1])) cacheReturnedBlocks(result);
  else cacheBlockList(result);
}

function asDbId(value: unknown): DbId | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function createPropertyRef(
  fromId: DbId,
  toId: DbId,
  alias: string,
): Promise<DbId> {
  const result = await orca.invokeBackend(
    "create-ref",
    fromId,
    toId,
    REF_TYPE_PROPERTY,
    alias,
  );
  const refId = asDbId(Array.isArray(result) ? result[0] : result);
  if (refId == null) {
    throw new Error(t("Failed to create a note reference"));
  }
  cacheWriteResult(result);
  orca.broadcasts.broadcast("orca.refresh-blocks", [fromId, toId]);
  return refId;
}

export async function writePropertyRefs(
  fromId: DbId,
  propName: string,
  ids: readonly DbId[],
  alsoRefresh?: DbId,
): Promise<void> {
  const result = await orca.invokeBackend(
    "set-properties",
    [fromId],
    [
      {
        name: propName,
        type: PROP_TYPE_BLOCK_REFS,
        value: [...ids],
      },
    ],
  );
  cacheWriteResult(result);
  const refresh = alsoRefresh != null ? [fromId, alsoRefresh] : [fromId];
  orca.broadcasts.broadcast("orca.refresh-blocks", refresh);
}

export async function writeEdgeLinkProp(
  fromId: DbId,
  ids: readonly DbId[],
  alsoRefresh?: DbId,
): Promise<void> {
  return writePropertyRefs(fromId, EDGE_LINK_PROP, ids, alsoRefresh);
}

export async function writeEdgeBackLinkProp(
  targetId: DbId,
  ids: readonly DbId[],
  alsoRefresh?: DbId,
): Promise<void> {
  return writePropertyRefs(targetId, EDGE_LINK_BACK_PROP, ids, alsoRefresh);
}

export async function linkEdgeByProperty(edge: WhiteboardEdge): Promise<DbId> {
  const sourceId = edgeSourceBlock(edge);
  const refId = await enqueueBlock(sourceId, async () => {
    const source = await fetchBlock(sourceId);
    const current = readEdgeLinkPropIds(source);
    const existing = findExistingEdgeLink(source.refs ?? [], current, edge.to);
    if (existing != null) return existing;

    const alias = edge.label?.trim() ?? "";
    const createdRefId = await createPropertyRef(sourceId, edge.to, alias);
    const fresh = await fetchBlock(sourceId);
    const latest = readEdgeLinkPropIds(fresh);
    const next = addLinkRefId(latest, createdRefId);
    if (linkRefIdsEqual(latest, next)) return createdRefId;
    try {
      await writeEdgeLinkProp(sourceId, next, edge.to);
    } catch (error) {
      try {
        await writeEdgeLinkProp(sourceId, latest, edge.to);
      } catch (recycleError) {
        console.error(
          "[whiteboard] failed to recycle orphan property ref",
          recycleError,
        );
      }
      throw error;
    }
    return createdRefId;
  });

  const settings = currentWhiteboardSettings();
  if (settings.bidirectionalEdgeLinks) {
    try {
      await linkEdgeBackByProperty(edge);
    } catch (backError) {
      console.error(
        "[whiteboard] failed to create note back-reference",
        backError,
      );
    }
  }

  return refId;
}

export async function unlinkEdgeByProperty(edge: WhiteboardEdge): Promise<void> {
  const sourceId = edgeSourceBlock(edge);
  await enqueueBlock(sourceId, async () => {
    // The source note may already be gone (deleted from the outline). Its
    // property ref went with it, so there is nothing left to unlink.
    const loaded = (await orca.invokeBackend(
      "get-block",
      sourceId,
    )) as Block | null;
    if (loaded == null) return;
    cacheBlockList([loaded]);
    const source = loaded;
    const current = readEdgeLinkPropIds(source);
    const refId =
      edge.linkRefId ??
      findExistingEdgeLink(source.refs ?? [], current, edge.to);
    if (refId == null) return;
    const next = removeLinkRefId(current, refId);
    if (linkRefIdsEqual(current, next)) return;
    await writeEdgeLinkProp(sourceId, next, edge.to);
  });

  try {
    await unlinkEdgeBackByProperty(edge);
  } catch (backError) {
    console.error(
      "[whiteboard] failed to remove note back-reference",
      backError,
    );
  }
}
