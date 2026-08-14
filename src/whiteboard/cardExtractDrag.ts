import type { DbId } from "../orca.d.ts";
import {
  EXTRACT_MIME,
  encodeExtractPayload,
  orcaBlocksPayload,
} from "./cardExtract";
import { orcaBlockMime } from "./dropBlocks";

export function writeExtractDragData(
  dataTransfer: DataTransfer,
  sourceCardId: DbId,
  blockId: DbId,
): void {
  dataTransfer.effectAllowed = "copy";
  dataTransfer.setData(orcaBlockMime(), orcaBlocksPayload([blockId]));
  dataTransfer.setData(
    EXTRACT_MIME,
    encodeExtractPayload({ source: sourceCardId, block: blockId }),
  );
}

export const EXTRACT_BULLET_CLASS = "owb-extract-bullet";

const EXTRACT_POINTER_SELECTOR = [
  `.${EXTRACT_BULLET_CLASS}`,
  ".orca-block-bullet",
  ".orca-block-bullet-dot",
].join(", ");

export function isExtractPointerTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(EXTRACT_POINTER_SELECTOR) != null;
}

export function blockIdFromCardEventTarget(
  target: EventTarget | null,
): DbId | null {
  if (!(target instanceof Element)) return null;
  const node = target.closest(".owb-card-block-node");
  if (node instanceof HTMLElement) {
    const id = Number(node.dataset.blockId);
    if (Number.isFinite(id)) return id;
  }
  const host = target.closest(".orca-block[data-id]");
  if (host instanceof HTMLElement) {
    const id = Number(host.getAttribute("data-id"));
    if (Number.isFinite(id)) return id;
  }
  return null;
}

export function startExtractBulletDrag(
  event: React.DragEvent,
  sourceCardId: DbId,
  blockId: DbId,
): void {
  const dataTransfer = event.dataTransfer;
  if (dataTransfer == null) {
    event.preventDefault();
    return;
  }
  event.stopPropagation();
  writeExtractDragData(dataTransfer, sourceCardId, blockId);
}
