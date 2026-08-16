import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { findOpenBoardPanelId } from "./boards";
import { PANEL_TYPE } from "./data";
import {
  asBlockId,
  collectBlockViewRoots,
  collectLiveRedirectKeys,
  isPageWhiteboardBlock,
  pruneRedirectKeys,
  redirectKey,
  shouldAutoOpenPageBoard,
} from "./pageBoardPlan";
import { currentWhiteboardSettings } from "./settings";

const SCAN_DEBOUNCE_MS = 100;
const FETCH_FAIL_COOLDOWN_MS = 10_000;

const suppressed = new Set<string>();
const redirected = new Set<string>();
const fetchInflight = new Map<DbId, Promise<Block | null>>();
const fetchFailedUntil = new Map<DbId, number>();
let redirectActive = false;

export function isOutlineRedirectSuppressed(
  panelId: string,
  blockId: DbId,
): boolean {
  return suppressed.has(redirectKey(panelId, blockId));
}

export function suppressOutlineRedirect(panelId: string, blockId: DbId): void {
  suppressed.add(redirectKey(panelId, blockId));
}

export function clearOutlineRedirectSuppress(
  panelId: string,
  blockId: DbId,
): void {
  suppressed.delete(redirectKey(panelId, blockId));
}

export function wasRedirected(panelId: string, blockId: DbId): boolean {
  return redirected.has(redirectKey(panelId, blockId));
}

export function markRedirected(panelId: string, blockId: DbId): void {
  redirected.add(redirectKey(panelId, blockId));
}

export function unmarkRedirected(panelId: string, blockId: DbId): void {
  redirected.delete(redirectKey(panelId, blockId));
}

function panelIsBlockView(panelId: string, blockId: DbId): boolean {
  try {
    const panel = orca.nav.findViewPanel(panelId, orca.state.panels);
    if (panel == null || panel.view !== "block") return false;
    return asBlockId(panel.viewArgs?.blockId) === blockId;
  } catch (err: unknown) {
    console.warn("[whiteboard] findViewPanel failed", err);
    return false;
  }
}

function resolveOutlinePanelId(blockId: DbId): string {
  const active = orca.state.activePanel;
  try {
    const panel = orca.nav.findViewPanel(active, orca.state.panels);
    if (asBlockId(panel?.viewArgs?.blockId) === blockId) return active;
  } catch (err: unknown) {
    console.warn("[whiteboard] findViewPanel failed", err);
  }
  return findOpenBoardPanelId(orca.state.panels, blockId) ?? active;
}

/** Switch this canvas back to the host outline without bouncing to canvas. */
export function openBoardAsOutline(blockId: DbId, panelId?: string): void {
  const id = panelId ?? resolveOutlinePanelId(blockId);
  suppressOutlineRedirect(id, blockId);
  try {
    orca.nav.replace("block", { blockId }, id);
  } catch (err: unknown) {
    clearOutlineRedirectSuppress(id, blockId);
    console.error("[whiteboard] failed to open as outline", err);
    orca.notify("error", t("Failed to open as outline"));
  }
}

async function loadBlockQuiet(blockId: DbId): Promise<Block | null> {
  const cached = orca.state.blocks[blockId];
  if (cached != null) return cached;
  const until = fetchFailedUntil.get(blockId);
  if (until != null && Date.now() < until) return null;
  const pending = fetchInflight.get(blockId);
  if (pending != null) return pending;
  const task = (async (): Promise<Block | null> => {
    try {
      const fresh = (await orca.invokeBackend("get-block", blockId)) as
        | Block
        | null;
      if (fresh != null && typeof fresh.id === "number") {
        orca.state.blocks[fresh.id] = fresh;
        fetchFailedUntil.delete(blockId);
        return fresh;
      }
      return null;
    } catch (err: unknown) {
      fetchFailedUntil.set(blockId, Date.now() + FETCH_FAIL_COOLDOWN_MS);
      console.warn("[whiteboard] get-block skipped for page redirect", err);
      return null;
    } finally {
      fetchInflight.delete(blockId);
    }
  })();
  fetchInflight.set(blockId, task);
  return task;
}

async function considerPanel(panelId: string, blockId: DbId): Promise<void> {
  if (!redirectActive) return;
  if (!currentWhiteboardSettings().openWhiteboardPagesAsCanvas) return;
  if (isOutlineRedirectSuppressed(panelId, blockId)) return;
  if (wasRedirected(panelId, blockId)) return;
  if (!panelIsBlockView(panelId, blockId)) return;

  const block = await loadBlockQuiet(blockId);
  if (!redirectActive || block == null) return;
  if (
    !shouldAutoOpenPageBoard({
      settingOn: currentWhiteboardSettings().openWhiteboardPagesAsCanvas,
      suppressed: isOutlineRedirectSuppressed(panelId, blockId),
      isPageWhiteboard: isPageWhiteboardBlock(block),
    })
  ) {
    return;
  }
  if (!panelIsBlockView(panelId, blockId)) return;
  if (wasRedirected(panelId, blockId)) return;

  markRedirected(panelId, blockId);
  try {
    orca.nav.replace(PANEL_TYPE, { blockId }, panelId);
  } catch (err: unknown) {
    unmarkRedirected(panelId, blockId);
    console.warn("[whiteboard] page-board canvas replace skipped", err);
  }
}

function scanPageBoardRedirects(): void {
  const panels = orca.state.panels;
  pruneRedirectKeys(suppressed, collectLiveRedirectKeys(panels));
  pruneRedirectKeys(redirected, collectLiveRedirectKeys(panels));
  if (!currentWhiteboardSettings().openWhiteboardPagesAsCanvas) return;
  for (const root of collectBlockViewRoots(panels)) {
    void considerPanel(root.panelId, root.blockId);
  }
}

export function startPageBoardRedirect(): () => void {
  const { subscribe } = window.Valtio as {
    subscribe: (
      proxyObject: object,
      callback: () => void,
      notifyInSync?: boolean,
    ) => () => void;
  };
  redirectActive = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (!redirectActive) return;
    if (timer != null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (redirectActive) scanPageBoardRedirects();
    }, SCAN_DEBOUNCE_MS);
  };
  let unsub: (() => void) | null = null;
  try {
    unsub = subscribe(orca.state.panels, schedule);
  } catch (err: unknown) {
    console.warn("[whiteboard] failed to subscribe to panels", err);
  }
  schedule();
  return () => {
    if (timer != null) clearTimeout(timer);
    unsub?.();
    resetPageBoardRedirectState();
  };
}

export function resetPageBoardRedirectState(): void {
  redirectActive = false;
  suppressed.clear();
  redirected.clear();
  fetchFailedUntil.clear();
  fetchInflight.clear();
}
