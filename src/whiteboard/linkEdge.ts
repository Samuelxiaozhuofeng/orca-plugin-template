import type { Block, ContentFragment, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { REF_TYPE_INLINE } from "./edgeRefs";
import type { WhiteboardEdge } from "./edges";
import { cacheBlockList, fetchBlock, insertLastChildTextBlock } from "./newCard";

function asRefId(value: unknown): DbId | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cacheReturnedBlocks(result: unknown): void {
  if (Array.isArray(result)) cacheBlockList(result[1]);
}

async function deleteBlockBestEffort(id: DbId): Promise<void> {
  try {
    const result = await orca.invokeBackend("delete-blocks", [id]);
    cacheReturnedBlocks(result);
    delete orca.state.blocks[id];
    orca.broadcasts.broadcast("orca.delete-blocks", [id]);
    orca.broadcasts.broadcast("orca.refresh-blocks", [id]);
  } catch (error) {
    console.error("[whiteboard] failed to delete leftover block", id, error);
  }
}

async function writeBlockContent(
  blockId: DbId,
  content: ContentFragment[],
): Promise<void> {
  const block = orca.state.blocks[blockId] as Block | undefined;
  const text = await orca.converters.blockConvert(
    "plain",
    { content },
    { type: "text" },
    block,
  );
  const result = await orca.invokeBackend("set-blocks-content", [
    {
      id: blockId,
      content,
      text,
      modified: new Date(),
    },
  ]);
  cacheReturnedBlocks(result);
  orca.broadcasts.broadcast("orca.refresh-blocks", [blockId]);
}

export function referenceFragments(
  label: string | undefined,
  refId: DbId,
): ContentFragment[] {
  const ref: ContentFragment = { t: "r", v: refId };
  const text = label?.trim() ?? "";
  if (text === "") return [ref];
  return [{ t: "t", v: `${text} → ` }, ref];
}

async function createInlineRef(fromId: DbId, toId: DbId): Promise<DbId> {
  const result = await orca.invokeBackend(
    "create-ref",
    fromId,
    toId,
    REF_TYPE_INLINE,
  );
  const refId = asRefId(Array.isArray(result) ? result[0] : result);
  if (refId == null) {
    throw new Error(t("Failed to create a note reference"));
  }
  cacheReturnedBlocks(result);
  orca.broadcasts.broadcast("orca.refresh-blocks", [fromId, toId]);
  return refId;
}

/**
 * Insert a child under the source block whose content is an inline reference
 * to the target. The child is a real note; deleting the whiteboard line later
 * does not remove it.
 */
/**
 * True when a child of `fromId` already carries an inline ref to `toId`.
 * Guards the window where the note write succeeded but marking the edge
 * `linked` did not — without this, a second attempt writes a duplicate
 * reference into the user's notes.
 */
async function alreadyLinked(fromId: DbId, toId: DbId): Promise<boolean> {
  const source = await fetchBlock(fromId);
  const children = source.children ?? [];
  if (children.length === 0) return false;
  const loaded = (await orca.invokeBackend("get-blocks", [...children])) as
    | Block[]
    | null;
  if (!Array.isArray(loaded)) return false;
  cacheBlockList(loaded);
  return loaded.some((child) =>
    (child.refs ?? []).some(
      (ref) => ref.to === toId && ref.type === REF_TYPE_INLINE,
    ),
  );
}

export async function linkEdgeToNote(edge: WhiteboardEdge): Promise<void> {
  if (await alreadyLinked(edge.from, edge.to)) return;
  const child = await insertLastChildTextBlock(edge.from);
  let refId: DbId;
  try {
    refId = await createInlineRef(child.id, edge.to);
  } catch (error) {
    await deleteBlockBestEffort(child.id);
    throw error;
  }
  try {
    await fetchBlock(child.id);
    await writeBlockContent(child.id, referenceFragments(edge.label, refId));
  } catch (error) {
    console.error("[whiteboard] create-ref succeeded, content write failed", error);
    throw new Error(
      t("Created the reference but could not write it into the new note."),
    );
  }
}
