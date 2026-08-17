import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { isWhiteboardShortcutTarget } from "./canvasKeys";
import type { WhiteboardCard } from "./cards";
import { orcaBlockMime } from "./dropBlocks";
import type { WhiteboardEdge } from "./edges";
import {
  parseOrcaClipboardPayload,
  planPasteClipboard,
  type RawContentFragment,
  resolvePasteTarget,
} from "./pasteBlocks";
import {
  pasteBlocksToBoard,
  pasteFragmentsToBoard,
  pasteTextToBoard,
} from "./pasteToBoard";

const { useEffect, useRef } = window.React;

export async function readOrcaClipboardAsync(): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.read) {
    return null;
  }
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const customType = item.types.find(
        (type) => type.startsWith("web orca") || type.startsWith("orca/"),
      );
      if (customType) {
        const blob = await item.getType(customType);
        const text = await blob.text();
        if (text) return text;
      }
    }
  } catch (error) {
    console.debug?.("[whiteboard] clipboard.read() fallback", error);
  }
  return null;
}

export function useBoardPaste(opts: {
  panelId: string;
  boardBlockId: DbId;
  searchOpen: boolean;
  viewportRef: { current: HTMLElement | null };
  editingRef: { current: DbId | null };
  cardsRef: { current: WhiteboardCard[] };
  edgesRef: { current: WhiteboardEdge[] };
  pointerToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  onAddCards: (cards: WhiteboardCard[]) => Promise<boolean>;
  onCommitEdges: (next: WhiteboardEdge[]) => Promise<boolean>;
  selectCards: (ids: DbId[]) => void;
}): void {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const lastPointerRef = useRef<{ clientX: number; clientY: number } | null>(
    null,
  );

  useEffect(() => {
    const viewport = optsRef.current.viewportRef.current;
    if (viewport == null) return;
    const onPointerMove = (event: PointerEvent) => {
      lastPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
    };
    viewport.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      viewport.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const ctx = optsRef.current;
      if (
        !isWhiteboardShortcutTarget(event, {
          panelId: ctx.panelId,
          editing: ctx.editingRef.current != null,
          viewport: ctx.viewportRef.current,
          searchOpen: ctx.searchOpen,
        })
      ) {
        return;
      }

      const syncPlan = planPasteClipboard(
        event.clipboardData,
        orcaBlockMime(),
      );

      const types = event.clipboardData
        ? Array.from(event.clipboardData.types)
        : [];
      const hasPotentialOrcaType = types.some(
        (t) => t.startsWith("web orca") || t.startsWith("orca/"),
      );

      if (syncPlan.kind === "none" && !hasPotentialOrcaType) {
        return;
      }

      event.preventDefault();

      const viewportEl = ctx.viewportRef.current;
      const viewportRect = viewportEl?.getBoundingClientRect() ?? null;
      const at = resolvePasteTarget({
        lastPointerClient: lastPointerRef.current,
        viewportRect,
        viewportFallback: {
          width: viewportEl?.clientWidth ?? 800,
          height: viewportEl?.clientHeight ?? 600,
        },
        pointerToWorld: ctx.pointerToWorld,
      });

      const handleBlocks = (ids: DbId[]) => {
        void pasteBlocksToBoard({
          ids,
          dataTransfer: event.clipboardData,
          at,
          existing: ctx.cardsRef.current,
          existingEdges: ctx.edgesRef.current,
          boardBlockId: ctx.boardBlockId,
          addCards: ctx.onAddCards,
          commitEdges: ctx.onCommitEdges,
        })
          .then((incoming) => {
            if (incoming.length > 0) {
              ctx.selectCards(incoming.map((card) => card.blockId));
            }
          })
          .catch((error: unknown) => {
            console.error("[whiteboard] failed to paste blocks to board", error);
            orca.notify("error", t("Failed to add blocks to the board"));
          });
      };

      const handleFragments = (fragments: RawContentFragment[]) => {
        void pasteFragmentsToBoard({
          fragments,
          at,
          boardBlockId: ctx.boardBlockId,
          addCards: ctx.onAddCards,
        })
          .then((card) => {
            if (card != null) {
              ctx.selectCards([card.blockId]);
            }
          })
          .catch((error: unknown) => {
            console.error(
              "[whiteboard] failed to paste fragments to board",
              error,
            );
            orca.notify("error", t("Failed to create a new card"));
          });
      };

      const handleText = (lines: readonly string[]) => {
        void pasteTextToBoard({
          lines,
          at,
          boardBlockId: ctx.boardBlockId,
          addCards: ctx.onAddCards,
        })
          .then((card) => {
            if (card != null) {
              ctx.selectCards([card.blockId]);
            }
          })
          .catch((error: unknown) => {
            console.error("[whiteboard] failed to paste text to board", error);
            orca.notify("error", t("Failed to create a new card"));
          });
      };

      if (syncPlan.kind === "fragments") {
        handleFragments(syncPlan.fragments);
        return;
      }

      if (syncPlan.kind === "blocks") {
        handleBlocks(syncPlan.ids);
        return;
      }

      const fallbackLines = syncPlan.kind === "text" ? syncPlan.lines : [];

      void (async () => {
        const rawAsync = await readOrcaClipboardAsync();
        if (rawAsync) {
          const parsed = parseOrcaClipboardPayload(rawAsync);
          if (parsed.kind === "fragments") {
            handleFragments(parsed.fragments);
            return;
          }
          if (parsed.kind === "blocks") {
            handleBlocks(parsed.ids);
            return;
          }
        }
        if (fallbackLines.length > 0) {
          handleText(fallbackLines);
        }
      })();
    };

    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("paste", onPaste);
    };
  }, []);
}
