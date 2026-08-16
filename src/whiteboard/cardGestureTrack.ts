type TrackedGesture = {
  abort: () => void;
  untrack: () => void;
};

const cardGestureBuckets = new WeakMap<object, Set<TrackedGesture>>();
const liveCardGestures = new Set<TrackedGesture>();

export function trackCardGesture(root: object, onAbort: () => void): TrackedGesture {
  let open = true;
  let bucket = cardGestureBuckets.get(root);
  if (bucket == null) {
    bucket = new Set();
    cardGestureBuckets.set(root, bucket);
  }
  const entry: TrackedGesture = {
    abort() {
      if (!open) return;
      open = false;
      bucket!.delete(entry);
      liveCardGestures.delete(entry);
      onAbort();
    },
    untrack() {
      if (!open) return;
      open = false;
      bucket!.delete(entry);
      liveCardGestures.delete(entry);
    },
  };
  bucket.add(entry);
  liveCardGestures.add(entry);
  return entry;
}

export function abortCardGestures(root: object | null | undefined): void {
  if (root == null) return;
  const bucket = cardGestureBuckets.get(root);
  if (bucket == null) return;
  for (const entry of [...bucket]) entry.abort();
}

/** Abort every in-flight card drag/resize and drop window listeners. */
export function abortAllCardGestures(): void {
  for (const entry of [...liveCardGestures]) entry.abort();
}
