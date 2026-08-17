import { t } from "../libs/l10n";
import { formatDeleteConfirmItems } from "./cardShell";

export { formatDeleteConfirmItems };

export function ConfirmDeleteDialog(props: {
  titles: readonly string[];
  onClose: () => void;
  onConfirm: () => void;
}): React.ReactNode {
  const { titles, onClose, onConfirm } = props;
  const { shown, remainingCount } = formatDeleteConfirmItems(titles, 8);

  return (
    <orca.components.ModalOverlay visible canClose onClose={onClose}>
      <div
        className="owb-dialog owb-confirm-dialog"
        role="dialog"
        aria-labelledby="owb-delete-confirm-title"
        onMouseDown={(event: React.MouseEvent) => event.stopPropagation()}
        onKeyDown={(event: React.KeyboardEvent) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <div id="owb-delete-confirm-title" className="owb-dialog-title">
          {t("Permanently delete notes?")}
        </div>
        <div className="owb-dialog-section">
          <div className="owb-dialog-warn">
            {t("This action cannot be undone.")}
          </div>
          <div className="owb-dialog-hint">
            {t(
              "The following notes and their whiteboard cards will be permanently deleted:",
            )}
          </div>
          <ul className="owb-delete-list">
            {shown.map((title, idx) => (
              <li key={idx} className="owb-delete-item">
                {title}
              </li>
            ))}
            {remainingCount > 0 ? (
              <li className="owb-delete-item-more">
                {t("…and ${count} others", { count: String(remainingCount) })}
              </li>
            ) : null}
          </ul>
        </div>
        <div className="owb-dialog-actions">
          <orca.components.Button variant="outline" onClick={onClose}>
            {t("Cancel")}
          </orca.components.Button>
          <orca.components.Button variant="dangerous" onClick={onConfirm}>
            {t("Delete permanently")}
          </orca.components.Button>
        </div>
      </div>
    </orca.components.ModalOverlay>
  );
}

let requestConfirmOpen = false;

export async function requestDeleteConfirm(
  titles: readonly string[],
): Promise<boolean> {
  if (requestConfirmOpen) return false;
  requestConfirmOpen = true;
  try {
    return await requestDeleteConfirmOnce(titles);
  } finally {
    requestConfirmOpen = false;
  }
}

async function requestDeleteConfirmOnce(
  titles: readonly string[],
): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "owb-confirm-host";
    document.body.appendChild(el);
    const root = window.createRoot(el);
    const finish = (value: boolean) => {
      resolve(value);
      root.unmount();
      el.remove();
    };
    root.render(
      <ConfirmDeleteDialog
        titles={titles}
        onClose={() => finish(false)}
        onConfirm={() => finish(true)}
      />,
    );
  });
}
