const outlineByPanel = new Map<string, () => void>();

/** Register this panel's toggle-outline action. Returns an unregister fn. */
export function registerSlideOutlineAction(
  panelId: string,
  toggle: () => void,
): () => void {
  outlineByPanel.set(panelId, toggle);
  return () => {
    if (outlineByPanel.get(panelId) === toggle) outlineByPanel.delete(panelId);
  };
}

/** No-op when the active panel is not a whiteboard that registered. */
export function invokeSlideOutlineOnActivePanel(): void {
  const panelId = orca.state.activePanel;
  if (panelId === "") return;
  outlineByPanel.get(panelId)?.();
}
