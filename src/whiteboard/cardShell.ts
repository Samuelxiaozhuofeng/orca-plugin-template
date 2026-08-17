import { isWhiteboardBlock, type BlockPropsLike } from "./pageBoardPlan.ts";
import { mediaKindOfBlock } from "./mediaCard.ts";

function typeOfRepr(value: unknown): string | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const type = (value as { type?: unknown }).type;
  return typeof type === "string" ? type : null;
}

export function blockReprType(block: unknown): string | null {
  if (block == null || typeof block !== "object") return null;
  const rec = block as { _repr?: unknown; properties?: unknown };
  const directType = typeOfRepr(rec._repr);
  if (directType != null) return directType;
  if (Array.isArray(rec.properties)) {
    for (const prop of rec.properties) {
      if (prop == null || typeof prop !== "object") continue;
      if ((prop as { name?: unknown }).name !== "_repr") continue;
      return typeOfRepr((prop as { value?: unknown }).value);
    }
  }
  return null;
}

/**
 * A block is an empty shell iff:
 * 1. text content is empty or whitespace only
 * 2. has no children
 * 3. has no back references (incoming refs is empty)
 * 4. is not a whiteboard (inline or page) and not media/file
 *
 * Any undetermined property results in false (conservative path).
 */
export function isCardShellBlock(block: unknown): boolean {
  if (block == null || typeof block !== "object") return false;
  const rec = block as {
    text?: unknown;
    content?: unknown;
    children?: unknown;
    backRefs?: unknown;
    aliases?: unknown;
    properties?: unknown;
    _repr?: unknown;
  };

  // A named page is never a shell, even when its body is empty.
  if (Array.isArray(rec.aliases) && rec.aliases.length > 0) return false;

  // 1. Must have backRefs array and it must be empty
  if (!Array.isArray(rec.backRefs) || rec.backRefs.length > 0) return false;

  // 2. Must have children array and it must be empty
  if (!Array.isArray(rec.children) || rec.children.length > 0) return false;

  // 3. Must not be a whiteboard (inline or page)
  const repr = blockReprType(rec);
  if (repr === "whiteboard.canvas" || isWhiteboardBlock(rec as BlockPropsLike)) {
    return false;
  }

  // 4. Must not be media or file
  if (mediaKindOfBlock(rec) != null) return false;
  if (repr != null && repr !== "text" && repr !== "heading" && repr !== "") {
    if (repr === "file" || repr === "media" || repr.startsWith("whiteboard.")) {
      return false;
    }
  }

  // 5. Text content must be empty or only whitespace
  if (typeof rec.text === "string") {
    if (rec.text.trim().length > 0) return false;
  } else if (rec.text != null) {
    return false;
  }

  if (Array.isArray(rec.content)) {
    for (const fragment of rec.content) {
      if (fragment == null || typeof fragment !== "object") return false;
      const frag = fragment as { t?: unknown; v?: unknown };
      if (frag.t !== "text" && frag.t !== undefined) return false;
      if (typeof frag.v === "string") {
        if (frag.v.trim().length > 0) return false;
      } else if (frag.v != null) {
        return false;
      }
    }
  } else if (rec.content != null) {
    return false;
  }

  return true;
}

export function formatDeleteConfirmItems(
  titles: readonly string[],
  maxShow: number = 8,
): {
  shown: string[];
  remainingCount: number;
} {
  if (titles.length <= maxShow) {
    return { shown: [...titles], remainingCount: 0 };
  }
  return {
    shown: titles.slice(0, maxShow),
    remainingCount: titles.length - maxShow,
  };
}
