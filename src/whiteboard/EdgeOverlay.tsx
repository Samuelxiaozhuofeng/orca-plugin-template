import type { WhiteboardEdge } from "./edges";
import { EdgeMenuItems } from "./EdgeMenuItems";
import type { EdgeEls } from "./edgeGestures";
import { bindEl } from "./useEdgeLayerApi";

const { useRef } = window.React;

type MenuAt = { edgeId: string; x: number; y: number };

export function EdgeMenuPopup(props: {
  menuAt: MenuAt | null;
  menuEdge: WhiteboardEdge | null;
  edges: WhiteboardEdge[];
  onCommit: (next: WhiteboardEdge[]) => Promise<boolean>;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const bodyRef = useRef(document.body);
  const { menuAt, menuEdge, edges, onCommit, onSelect, onClose } = props;
  if (menuEdge == null) return null;
  return (
    <orca.components.Popup
      visible
      rect={new DOMRect(menuAt!.x, menuAt!.y, 1, 1)}
      container={bodyRef}
      allowBeyondContainer
      escapeToClose
      defaultPlacement="bottom"
      alignment="left"
      onClose={onClose}
    >
      <orca.components.Menu>
        <EdgeMenuItems
          edge={menuEdge}
          edges={edges}
          close={onClose}
          onCommit={onCommit}
          onSelect={onSelect}
        />
      </orca.components.Menu>
    </orca.components.Popup>
  );
}

export function EdgeLabelLayer(props: {
  edges: WhiteboardEdge[];
  editingId: string | null;
  editing: WhiteboardEdge | null;
  editingCurve: { label: { x: number; y: number } } | null;
  els: Map<string, EdgeEls>;
  curveOf: (edge: WhiteboardEdge) => { label: { x: number; y: number } } | null;
  applyLabel: (id: string, raw: string) => void;
  skipBlurRef: { current: boolean };
  setEditingId: (id: string | null) => void;
}) {
  const {
    edges,
    editingId,
    editing,
    editingCurve,
    els,
    curveOf,
    applyLabel,
    skipBlurRef,
    setEditingId,
  } = props;
  return (
    <div className="owb-edge-labels">
      {edges.map((edge) => {
        if (edge.id === editingId) return null;
        if (edge.label == null && !edge.linked) return null;
        const curve = curveOf(edge);
        if (curve == null) return null;
        return (
          <div
            key={edge.id}
            ref={bindEl(els, edge.id, "label")}
            className={
              edge.label != null ? "owb-edge-label" : "owb-edge-link-badge"
            }
            style={{ left: curve.label.x, top: curve.label.y }}
          >
            {edge.linked ? (
              <i className="ti ti-link owb-edge-link-icon" />
            ) : null}
            {edge.label}
          </div>
        );
      })}
      {editing != null && editingCurve != null ? (
        <input
          className="owb-edge-editor"
          defaultValue={editing.label ?? ""}
          autoFocus
          style={{
            left: editingCurve.label.x,
            top: editingCurve.label.y,
            minWidth: 60,
          }}
          onMouseDown={(event: React.MouseEvent) => event.stopPropagation()}
          onInput={(event: React.FormEvent<HTMLInputElement>) => {
            const el = event.currentTarget;
            el.style.width = "60px";
            el.style.width = `${Math.max(60, el.scrollWidth + 2)}px`;
          }}
          onFocus={(event: React.FocusEvent<HTMLInputElement>) => {
            const el = event.currentTarget;
            el.style.width = `${Math.max(60, el.scrollWidth + 2)}px`;
          }}
          onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyLabel(editing.id, event.currentTarget.value);
            } else if (event.key === "Escape") {
              event.preventDefault();
              skipBlurRef.current = true;
              setEditingId(null);
            }
          }}
          onBlur={(event: React.FocusEvent<HTMLInputElement>) => {
            if (skipBlurRef.current) {
              skipBlurRef.current = false;
              return;
            }
            applyLabel(editing.id, event.currentTarget.value);
          }}
        />
      ) : null}
    </div>
  );
}
