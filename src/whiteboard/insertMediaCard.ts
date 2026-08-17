import type { Block, ContentFragment, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n.ts";
import type { WhiteboardCard } from "./data";

export type MediaKind = "pdf" | "epub" | "video" | "audio" | "image";

export const MEDIA_ACCEPT: Record<MediaKind, string> = {
  pdf: "application/pdf,.pdf",
  epub: "application/epub+zip,application/epub,.epub",
  video: "video/*",
  audio: "audio/*",
  image: "image/*",
};

export function acceptForMediaKind(kind: MediaKind): string {
  return MEDIA_ACCEPT[kind];
}

export function mediaBlockRepr(
  kind: MediaKind,
  src: string,
): { type: MediaKind; src: string } {
  return { type: kind, src };
}

export function mediaBlockText(kind: MediaKind, src: string): string {
  return `${kind}: ${src}`;
}

/** Pull `uploaded[0]` from `upload-assets`, or null if the payload is unusable. */
export function uploadedAssetSrc(result: unknown): string | null {
  if (result == null || typeof result !== "object") return null;
  const uploaded = (result as { uploaded?: unknown }).uploaded;
  if (!Array.isArray(uploaded)) return null;
  const first = uploaded[0];
  if (typeof first !== "string" || first.length === 0) return null;
  return first;
}

type OrcaBridge = {
  getFilePath?: (file: File) => unknown;
};

function orcaBridgeGetFilePath(): ((file: File) => unknown) | null {
  const bridge = (window as unknown as { orcaBridge?: OrcaBridge }).orcaBridge;
  if (bridge == null || typeof bridge.getFilePath !== "function") return null;
  return bridge.getFilePath;
}

function fileAbsolutePath(file: File): string | null {
  const getFilePath = orcaBridgeGetFilePath();
  if (getFilePath == null) return null;
  try {
    const path = getFilePath(file);
    if (typeof path !== "string" || path.length === 0) return null;
    return path;
  } catch {
    return null;
  }
}

function pickLocalFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";
    input.style.width = "1px";
    input.style.height = "1px";
    input.style.opacity = "0";
    let settled = false;

    const cleanup = () => {
      input.removeEventListener("change", onChange);
      input.removeEventListener("cancel", onCancel);
      window.removeEventListener("focus", onWindowFocus);
      window.clearTimeout(focusTimer);
      input.remove();
    };

    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(file);
    };

    const onChange = () => {
      finish(input.files?.[0] ?? null);
    };
    const onCancel = () => finish(null);

    let focusTimer = 0;
    const onWindowFocus = () => {
      // Fallback for environments without the `cancel` event. Re-read `files`
      // instead of assuming a cancel: `change` can land after focus returns.
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        finish(input.files?.[0] ?? null);
      }, 1_000);
    };

    input.addEventListener("change", onChange);
    input.addEventListener("cancel", onCancel);
    document.body.appendChild(input);
    input.click();
    window.addEventListener("focus", onWindowFocus);
  });
}

async function insertLastChildMediaBlock(
  parentId: DbId,
  kind: MediaKind,
  src: string,
): Promise<Block> {
  // On-demand so Node tests can import the pure helpers without loading newCard.
  const { createdBlockFromResult, fetchBlock } = await import("./newCard");
  const parent = await fetchBlock(parentId);
  const children = parent.children ?? [];
  const left = children.length > 0 ? children[children.length - 1] : null;
  const text = mediaBlockText(kind, src);
  const content: ContentFragment[] = [{ t: "t", v: text }];
  const result = await orca.invokeBackend(
    "create-block",
    parentId,
    left,
    null,
    null,
    mediaBlockRepr(kind, src),
    content,
    text,
  );
  const created = createdBlockFromResult(result);
  orca.broadcasts.broadcast("orca.refresh-blocks", [parentId, created.id]);
  return created;
}

export async function addMediaCardToBoard(opts: {
  boardBlockId: DbId;
  x: number;
  y: number;
  kind: MediaKind;
  addCards: (cards: WhiteboardCard[]) => Promise<boolean>;
}): Promise<WhiteboardCard | null> {
  if (orcaBridgeGetFilePath() == null) {
    orca.notify(
      "error",
      t(
        "Can't pick a local file in this Orca version. Update Orca and try again.",
      ),
    );
    return null;
  }

  let phase: "pick" | "copy" | "create" = "pick";
  try {
    const file = await pickLocalFile(acceptForMediaKind(opts.kind));
    if (file == null) return null;

    const absPath = fileAbsolutePath(file);
    if (absPath == null) {
      orca.notify(
        "error",
        t(
          "Can't pick a local file in this Orca version. Update Orca and try again.",
        ),
      );
      return null;
    }

    phase = "copy";
    const uploaded = uploadedAssetSrc(
      await orca.invokeBackend("upload-assets", [absPath]),
    );
    if (uploaded == null) {
      orca.notify("error", t("Failed to copy the file into this notebook"));
      return null;
    }

    phase = "create";
    const created = await insertLastChildMediaBlock(
      opts.boardBlockId,
      opts.kind,
      uploaded,
    );
    const { blankCardAt } = await import("./newCard");
    const { mediaCardSize } = await import("./mediaCard");
    const card = {
      ...blankCardAt(created.id, opts.x, opts.y),
      ...mediaCardSize(opts.kind),
    };
    const saved = await opts.addCards([card]);
    if (!saved) {
      orca.notify(
        "error",
        t(
          "Created the note but could not save it as a card. The new note is under this board in the outline.",
        ),
      );
      return null;
    }
    return card;
  } catch (error) {
    console.error("[whiteboard] insert media card failed", error);
    if (phase === "copy") {
      orca.notify("error", t("Failed to copy the file into this notebook"));
    } else if (phase === "create") {
      orca.notify("error", t("Failed to create a media card"));
    } else {
      orca.notify(
        "error",
        t(
          "Can't pick a local file in this Orca version. Update Orca and try again.",
        ),
      );
    }
    return null;
  }
}
