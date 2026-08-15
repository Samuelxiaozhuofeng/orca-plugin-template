import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { PANEL_TYPE } from "./data";
import { isPanelBlockViewRoot } from "./pageBoard";
import {
  isOutlineRedirectSuppressed,
  markRedirected,
  unmarkRedirected,
  wasRedirected,
} from "./pageBoardRedirect";
import { shouldAutoOpenInlineRoot } from "./pageBoardPlan";
import { useWhiteboardSettings } from "./settings";

const { useEffect, useRef } = window.React;

/** When a block-view panel is rooted on an inline whiteboard, switch to the canvas. */
export function useOpenWhiteboardPageAsCanvas(
  panelId: string,
  blockId: DbId,
): void {
  const { openWhiteboardPagesAsCanvas } = useWhiteboardSettings();
  const onceRef = useRef(false);

  useEffect(() => {
    if (
      !shouldAutoOpenInlineRoot({
        settingOn: openWhiteboardPagesAsCanvas,
        suppressed: isOutlineRedirectSuppressed(panelId, blockId),
        isInlineWhiteboard: true,
        isPanelRoot: isPanelBlockViewRoot(panelId, blockId),
      })
    ) {
      return;
    }
    if (onceRef.current) return;
    if (wasRedirected(panelId, blockId)) return;
    onceRef.current = true;
    markRedirected(panelId, blockId);
    try {
      orca.nav.replace(PANEL_TYPE, { blockId }, panelId);
    } catch (err: unknown) {
      onceRef.current = false;
      unmarkRedirected(panelId, blockId);
      console.error("[whiteboard] failed to open page as canvas", err);
      orca.notify("error", t("Failed to open whiteboard panel"));
    }
    return () => {
      unmarkRedirected(panelId, blockId);
    };
  }, [panelId, blockId, openWhiteboardPagesAsCanvas]);
}
