/**
 * Keep media inside whiteboard cards silent until the user asks for it.
 *
 * Orca's own media blocks may carry `autoplay`, and a card tree can mount at
 * any time (opening a board, panning a card back into view, a re-render).
 * Without this guard every such mount starts playback on its own. The guard
 * only ever stops playback that no one asked for: once the user interacts with
 * a player, that element is remembered and never touched again.
 */

const MEDIA_SELECTOR = "video, audio";

/** Elements the user has actually interacted with — never auto-paused. */
const userDriven = new WeakSet<HTMLMediaElement>();

/** Elements already wired, so repeated passes stay cheap and idempotent. */
const guarded = new WeakSet<HTMLMediaElement>();

function isMedia(node: Node): node is HTMLMediaElement {
  const tag = (node as Element).tagName;
  return tag === "VIDEO" || tag === "AUDIO";
}

function markUserDriven(target: EventTarget | null): void {
  const el = target as Element | null;
  if (el == null || typeof el.closest !== "function") return;
  const media = el.closest<HTMLMediaElement>(MEDIA_SELECTOR);
  if (media != null) userDriven.add(media);
}

function quiet(media: HTMLMediaElement): void {
  if (userDriven.has(media)) return;
  try {
    media.autoplay = false;
    media.removeAttribute("autoplay");
    // Metadata is enough to show the first frame / duration without streaming.
    if (media.preload === "auto" || media.getAttribute("preload") == null) {
      media.preload = "metadata";
    }
    if (!media.paused) {
      media.pause();
      if (media.currentTime > 0 && media.currentTime < 1) media.currentTime = 0;
    }
  } catch {
    // A detached or cross-origin player must not break the card tree.
  }
}

function guard(media: HTMLMediaElement): void {
  quiet(media);
  if (guarded.has(media)) return;
  guarded.add(media);
  // Orca may set `src`/`autoplay` after mount; catch the resulting play too.
  media.addEventListener("play", () => {
    if (userDriven.has(media)) return;
    try {
      media.pause();
    } catch {
      // Ignore — the element may already be gone.
    }
  });
}

function scan(root: ParentNode): void {
  for (const media of root.querySelectorAll<HTMLMediaElement>(MEDIA_SELECTOR)) {
    guard(media);
  }
}

/**
 * Watch one card tree. Returns a full teardown.
 * Safe to call on any element; never throws.
 */
export function attachMediaAutoplayGuard(root: HTMLElement): () => void {
  const onUserIntent = (event: Event): void => {
    markUserDriven(event.target);
  };

  // Capture phase: the click that hits the player's own controls counts as
  // consent even though Orca stops the event before it bubbles out.
  root.addEventListener("pointerdown", onUserIntent, true);
  root.addEventListener("keydown", onUserIntent, true);

  scan(root);

  let observer: MutationObserver | null = null;
  try {
    observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (isMedia(node)) guard(node);
          else scan(node as Element);
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
  } catch {
    observer = null;
  }

  return () => {
    root.removeEventListener("pointerdown", onUserIntent, true);
    root.removeEventListener("keydown", onUserIntent, true);
    observer?.disconnect();
  };
}
