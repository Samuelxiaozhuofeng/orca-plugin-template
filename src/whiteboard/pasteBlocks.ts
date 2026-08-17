import type { ContentFragment, DbId } from "../orca.d.ts";

/** A fragment as it arrives on the clipboard: refs still carry `to`/`alias`
 * instead of a local `v`, so `v` is optional here unlike `ContentFragment`. */
export type RawContentFragment = {
  t: string;
  v?: unknown;
  to?: DbId;
  alias?: string;
  a?: string;
  vArgs?: Record<string, unknown>;
  [key: string]: unknown;
};

export type PasteContentPlan =
  | { kind: "fragments"; fragments: RawContentFragment[] }
  | { kind: "blocks"; ids: DbId[] }
  | { kind: "text"; title: string; children: string[]; lines: string[] }
  | { kind: "none" };

export type OrcaClipboardPayloadResult =
  | { kind: "fragments"; fragments: RawContentFragment[] }
  | { kind: "blocks"; ids: DbId[] }
  | { kind: "none" };

export function parsePasteLines(text: string | null | undefined): string[] {
  if (text == null) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function getOrcaClipboardRaw(
  dataTransfer:
    | DataTransfer
    | { getData(format: string): string; types?: readonly string[] | DOMStringList }
    | null
    | undefined,
  mime?: string,
): string {
  if (dataTransfer == null) return "";
  const baseMime =
    mime ??
    (typeof orca !== "undefined" && orca.state?.repo
      ? `orca/${encodeURIComponent(orca.state.repo).toLowerCase()}`
      : "");

  if (baseMime) {
    const webMime = baseMime.startsWith("web ") ? baseMime : `web ${baseMime}`;
    const directMime = baseMime.startsWith("web ")
      ? baseMime.slice(4)
      : baseMime;

    const webRaw = dataTransfer.getData(webMime);
    if (webRaw) return webRaw;
    const directRaw = dataTransfer.getData(directMime);
    if (directRaw) return directRaw;
  }

  if ("types" in dataTransfer && dataTransfer.types) {
    const typeList = Array.from(dataTransfer.types);
    const webType = typeList.find(
      (t) => typeof t === "string" && t.startsWith("web orca/"),
    );
    if (webType) {
      const raw = dataTransfer.getData(webType);
      if (raw) return raw;
    }
    const directType = typeList.find(
      (t) => typeof t === "string" && t.startsWith("orca/"),
    );
    if (directType) {
      const raw = dataTransfer.getData(directType);
      if (raw) return raw;
    }
  }

  return "";
}

export function parseOrcaClipboardPayload(
  raw: string,
): OrcaClipboardPayloadResult {
  if (!raw) return { kind: "none" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "none" };
  }
  if (parsed == null || typeof parsed !== "object") return { kind: "none" };

  const payload = parsed as {
    blocks?: unknown;
    fragments?: unknown;
    highlight?: unknown;
  };

  if (Array.isArray(payload.fragments) && payload.fragments.length > 0) {
    const fragments: ContentFragment[] = [];
    for (const item of payload.fragments) {
      if (
        item != null &&
        typeof item === "object" &&
        typeof (item as ContentFragment).t === "string"
      ) {
        fragments.push(item as ContentFragment);
      }
    }
    if (fragments.length > 0) {
      return { kind: "fragments", fragments };
    }
  }

  if ("highlight" in payload) return { kind: "none" };

  if (Array.isArray(payload.blocks)) {
    const ids: DbId[] = [];
    for (const item of payload.blocks) {
      if (typeof item === "number" && Number.isFinite(item)) {
        ids.push(item);
      }
    }
    if (ids.length > 0) {
      return { kind: "blocks", ids };
    }
  }

  return { kind: "none" };
}

export function parseDroppedBlockIds(
  dataTransfer:
    | DataTransfer
    | { getData(format: string): string; types?: readonly string[] | DOMStringList }
    | null
    | undefined,
  mime?: string,
): DbId[] {
  const raw = getOrcaClipboardRaw(dataTransfer, mime);
  if (!raw) return [];
  const parsed = parseOrcaClipboardPayload(raw);
  if (parsed.kind === "blocks") {
    return parsed.ids;
  }
  return [];
}

export function planPasteClipboard(
  dataTransfer:
    | DataTransfer
    | { getData(format: string): string; types?: readonly string[] | DOMStringList }
    | null
    | undefined,
  mime?: string,
): PasteContentPlan {
  if (dataTransfer == null) return { kind: "none" };

  const raw = getOrcaClipboardRaw(dataTransfer, mime);
  if (raw) {
    const parsed = parseOrcaClipboardPayload(raw);
    if (parsed.kind === "fragments") {
      return { kind: "fragments", fragments: parsed.fragments };
    }
    if (parsed.kind === "blocks") {
      return { kind: "blocks", ids: parsed.ids };
    }
  }

  const rawText = dataTransfer.getData("text/plain");
  const lines = parsePasteLines(rawText);
  if (lines.length > 0) {
    const [title, ...children] = lines;
    return { kind: "text", title, children, lines };
  }

  return { kind: "none" };
}

export async function rewriteFragmentsWithRefs(
  fragments: readonly RawContentFragment[],
  createRef: (toId: DbId, alias: string | undefined) => Promise<DbId | null>,
): Promise<ContentFragment[]> {
  const result: ContentFragment[] = [];
  for (const frag of fragments) {
    if (
      frag.t === "r" &&
      frag.to != null &&
      typeof frag.to === "number" &&
      Number.isFinite(frag.to)
    ) {
      try {
        const refId = await createRef(frag.to, frag.alias);
        if (refId != null) {
          const nextFrag: ContentFragment = { ...frag, v: refId };
          delete nextFrag.to;
          delete nextFrag.alias;
          result.push(nextFrag);
        } else {
          console.error(
            "[whiteboard] failed to create reference for fragment",
            frag,
          );
          result.push({
            t: "t",
            v: typeof frag.alias === "string" ? frag.alias : "",
          });
        }
      } catch (err) {
        console.error(
          "[whiteboard] failed to create reference for fragment",
          frag,
          err,
        );
        result.push({
          t: "t",
          v: typeof frag.alias === "string" ? frag.alias : "",
        });
      }
    } else {
      result.push({ ...frag, v: frag.v ?? "" });
    }
  }
  return result;
}

export function resolvePasteTarget(opts: {
  lastPointerClient: { clientX: number; clientY: number } | null;
  viewportRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
  viewportFallback: { width: number; height: number };
  pointerToWorld: (clientX: number, clientY: number) => {
    x: number;
    y: number;
  };
}): { x: number; y: number } {
  if (opts.lastPointerClient != null) {
    return opts.pointerToWorld(
      opts.lastPointerClient.clientX,
      opts.lastPointerClient.clientY,
    );
  }
  if (opts.viewportRect != null) {
    return opts.pointerToWorld(
      opts.viewportRect.left + opts.viewportRect.width / 2,
      opts.viewportRect.top + opts.viewportRect.height / 2,
    );
  }
  return opts.pointerToWorld(
    opts.viewportFallback.width / 2,
    opts.viewportFallback.height / 2,
  );
}
