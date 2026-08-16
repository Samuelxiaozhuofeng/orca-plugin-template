import type { DbId } from "../orca.d.ts";

const MEDIA_TYPES = new Set(["pdf", "epub"]);
const REF_EL_SELECTOR = '[data-type="r"][data-ref]';
const ROW_SELECTOR = ".owb-card-block-node[data-block-id]";
const POLL_MS = 50;
const POLL_MAX_MS = 1_500;

export type MediaRefVArgs = Record<string, unknown>;

export type MediaRefFragment = {
  t?: unknown;
  v?: unknown;
  vArgs?: unknown;
  a?: unknown;
};

export type MediaRefRecord = {
  id?: unknown;
  to?: unknown;
};

export type MediaRefSourceBlock = {
  content?: readonly MediaRefFragment[] | null;
  refs?: readonly MediaRefRecord[] | null;
};

export type MediaRefBlockMap = {
  readonly [id: number]: MediaRefSourceBlock | undefined;
};

type PanelLike = {
  view?: unknown;
  viewArgs?: Record<string, unknown> | null;
  viewState?: Record<string, unknown> | null;
  children?: unknown;
};

/**
 * Pick the highlight `vArgs` for a media ref inside one source block.
 * `index` is the document-order rank among DOM refs to the same media block;
 * ignored when the block has exactly one matching fragment.
 */
export function resolveMediaRefVArgs(
  blocks: MediaRefBlockMap | null | undefined,
  sourceBlockId: number,
  mediaBlockId: number,
  index: number,
): MediaRefVArgs | null {
  try {
    if (blocks == null || typeof blocks !== "object") return null;
    if (!Number.isFinite(sourceBlockId) || !Number.isFinite(mediaBlockId)) {
      return null;
    }
    const source = blocks[sourceBlockId];
    if (source == null || typeof source !== "object") return null;
    const content = source.content;
    if (content == null || !Array.isArray(content) || content.length === 0) {
      return null;
    }
    const refs = source.refs;
    const matches: MediaRefVArgs[] = [];
    for (const frag of content) {
      if (frag == null || typeof frag !== "object") continue;
      if (frag.t !== "r") continue;
      if (!isVArgs(frag.vArgs)) continue;
      if (!refPointsTo(refs, frag.v, mediaBlockId)) continue;
      matches.push(frag.vArgs);
    }
    if (matches.length === 1) return matches[0]!;
    if (matches.length === 0) return null;
    if (!Number.isInteger(index) || index < 0 || index >= matches.length) {
      return null;
    }
    return matches[index]!;
  } catch {
    return null;
  }
}

export function findOpenMediaReaderPanel(
  panels: unknown,
  mediaBlockId: number,
): PanelLike | null {
  try {
    if (!Number.isFinite(mediaBlockId)) return null;
    const leaves: PanelLike[] = [];
    collectViewPanels(panels, leaves);
    for (const panel of leaves) {
      if (panel.view !== "block") continue;
      const args = panel.viewArgs;
      if (args == null || typeof args !== "object") continue;
      if (args.view !== "normal") continue;
      if (!sameBlockId(args.blockId, mediaBlockId)) continue;
      return panel;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeMediaReaderAnchor(
  panel: PanelLike | null | undefined,
  mediaBlockId: number,
  vArgs: MediaRefVArgs,
): boolean {
  try {
    if (panel == null || typeof panel !== "object") return false;
    if (!Number.isFinite(mediaBlockId) || !isVArgs(vArgs)) return false;
    const viewState = panel.viewState;
    if (viewState == null || typeof viewState !== "object") return false;
    const key = String(mediaBlockId);
    const slot = viewState[key];
    if (slot == null || typeof slot !== "object" || Array.isArray(slot)) {
      viewState[key] = { anchor: vArgs };
      return true;
    }
    (slot as { anchor?: unknown }).anchor = vArgs;
    return true;
  } catch {
    return false;
  }
}

export function isMediaReaderBlock(block: unknown): boolean {
  const type = blockReprType(block);
  return type != null && MEDIA_TYPES.has(type);
}

/** Capture-phase click handler on one card tree. Returns a full teardown. */
export function attachMediaRefJump(root: HTMLElement): () => void {
  let pollTimer = 0;

  const clearPoll = (): void => {
    if (pollTimer === 0) return;
    window.clearTimeout(pollTimer);
    pollTimer = 0;
  };

  const schedule = (fn: () => void, ms: number): void => {
    clearPoll();
    pollTimer = window.setTimeout(fn, ms);
  };

  const onClick = (event: MouseEvent): void => {
    try {
      if (!tryHandleMediaRefClick(event, root, clearPoll, schedule)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    } catch {
      // Never let a bad click take down the card tree.
    }
  };

  root.addEventListener("click", onClick, true);
  return () => {
    root.removeEventListener("click", onClick, true);
    clearPoll();
  };
}

function tryHandleMediaRefClick(
  event: MouseEvent,
  root: HTMLElement,
  clearPoll: () => void,
  schedule: (fn: () => void, ms: number) => void,
): boolean {
  if (event.button != null && event.button !== 0) return false;
  const target = event.target;
  if (!(target instanceof Element)) return false;

  const refEl = target.closest<HTMLElement>(REF_EL_SELECTOR);
  if (refEl == null) return false;

  const mediaBlockId = Number(refEl.dataset.ref);
  if (!Number.isFinite(mediaBlockId)) return false;

  // Promoted rows omit data-block-id; do not walk up to the card wrapper.
  const rowEl = refEl.closest<HTMLElement>(ROW_SELECTOR);
  if (rowEl == null) return false;
  const sourceBlockId = Number(rowEl.dataset.blockId);
  if (!Number.isFinite(sourceBlockId)) return false;

  if (isCardOnThisCanvas(root, mediaBlockId)) return false;

  let blocks: MediaRefBlockMap | undefined;
  try {
    blocks = orca.state?.blocks as MediaRefBlockMap | undefined;
  } catch {
    return false;
  }
  if (blocks == null) return false;

  let mediaBlock: unknown;
  try {
    mediaBlock = (blocks as { [id: number]: unknown })[mediaBlockId];
  } catch {
    return false;
  }
  if (!isMediaReaderBlock(mediaBlock)) return false;

  const index = indexOfMediaRefEl(rowEl, refEl, mediaBlockId);
  if (index < 0) return false;

  const vArgs = resolveMediaRefVArgs(
    blocks,
    sourceBlockId,
    mediaBlockId,
    index,
  );
  if (vArgs == null) return false;

  let panels: unknown;
  try {
    panels = orca.state?.panels;
  } catch {
    return false;
  }
  const open = findOpenMediaReaderPanel(panels, mediaBlockId);
  if (open != null) {
    clearPoll();
    return writeMediaReaderAnchor(open, mediaBlockId, vArgs);
  }
  return openThenAnchor(mediaBlockId, vArgs, clearPoll, schedule);
}

function openThenAnchor(
  mediaBlockId: DbId,
  vArgs: MediaRefVArgs,
  clearPoll: () => void,
  schedule: (fn: () => void, ms: number) => void,
): boolean {
  clearPoll();
  try {
    if (typeof orca.nav?.openInLastPanel !== "function") return false;
    orca.nav.openInLastPanel("block", {
      blockId: mediaBlockId,
      view: "normal",
      maximize: "1",
    });
  } catch {
    return false;
  }

  const started = Date.now();
  const tick = (): void => {
    try {
      const panel = findOpenMediaReaderPanel(
        orca.state?.panels,
        mediaBlockId,
      );
      if (panel != null) {
        writeMediaReaderAnchor(panel, mediaBlockId, vArgs);
        return;
      }
    } catch {
      return;
    }
    if (Date.now() - started >= POLL_MAX_MS) {
      clearPoll();
      return;
    }
    schedule(tick, POLL_MS);
  };
  tick();
  return true;
}

function indexOfMediaRefEl(
  rowEl: HTMLElement,
  refEl: HTMLElement,
  mediaBlockId: number,
): number {
  const nodes = rowEl.querySelectorAll<HTMLElement>(REF_EL_SELECTOR);
  let index = 0;
  for (const node of nodes) {
    if (Number(node.dataset.ref) !== mediaBlockId) continue;
    if (node === refEl) return index;
    index += 1;
  }
  return -1;
}

function isCardOnThisCanvas(from: HTMLElement, blockId: number): boolean {
  try {
    const canvas = from.closest(".owb-canvas");
    if (canvas == null) return false;
    return (
      canvas.querySelector(`.owb-card[data-block-id="${blockId}"]`) != null
    );
  } catch {
    return false;
  }
}

function collectViewPanels(node: unknown, out: PanelLike[]): void {
  if (node == null || typeof node !== "object") return;
  const panel = node as PanelLike;
  if (panel.children == null) {
    out.push(panel);
    return;
  }
  if (!Array.isArray(panel.children)) return;
  for (const child of panel.children) {
    collectViewPanels(child, out);
  }
}

function refPointsTo(
  refs: readonly MediaRefRecord[] | null | undefined,
  fragV: unknown,
  mediaBlockId: number,
): boolean {
  if (refs == null || !Array.isArray(refs)) return false;
  const found = refs.find((ref) => ref != null && sameId(ref.id, fragV));
  if (found == null) return false;
  return sameBlockId(found.to, mediaBlockId);
}

function sameBlockId(value: unknown, id: number): boolean {
  if (value === id) return true;
  if (typeof value === "string" && value !== "" && Number(value) === id) {
    return true;
  }
  return false;
}

function sameId(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === "number" && typeof b === "number") return a === b;
  return String(a) === String(b);
}

function isVArgs(value: unknown): value is MediaRefVArgs {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function blockReprType(block: unknown): string | null {
  if (block == null || typeof block !== "object") return null;
  const rec = block as { _repr?: unknown; properties?: unknown };
  const typeOf = (value: unknown): string | null => {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const type = (value as { type?: unknown }).type;
    return typeof type === "string" ? type : null;
  };
  const direct = typeOf(rec._repr);
  if (direct != null) return direct;
  const props = rec.properties;
  if (!Array.isArray(props)) return null;
  for (const prop of props) {
    if (prop == null || typeof prop !== "object") continue;
    if ((prop as { name?: unknown }).name !== "_repr") continue;
    return typeOf((prop as { value?: unknown }).value);
  }
  return null;
}
