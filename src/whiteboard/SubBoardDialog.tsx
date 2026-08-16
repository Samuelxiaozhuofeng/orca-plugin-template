import { t } from "../libs/l10n";
import { pickFreeAliasName, aliasExists } from "./pageBoardCreate";
import { isBlankPageName, normalizePageName } from "./pageBoardPlan";
import type { SubBoardKind } from "./createSubBoard";

const { useEffect, useRef, useState } = window.React;

export type SubBoardDialogResult = {
  name: string;
  kind: SubBoardKind;
};

function isComposingKey(event: React.KeyboardEvent): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

export function SubBoardDialog(props: {
  defaultName: string;
  onClose: () => void;
  onConfirm: (result: SubBoardDialogResult) => void;
}): React.ReactNode {
  const [name, setName] = useState(props.defaultName);
  const [kind, setKind] = useState<SubBoardKind>("page");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current?.querySelector("input");
    if (el == null) return;
    el.focus();
    el.select();
  }, []);

  const usable = !isBlankPageName(name);

  const submit = async () => {
    const trimmed = normalizePageName(name);
    if (trimmed === "" || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "page" && (await aliasExists(trimmed))) {
        setError(t("A page with this name already exists. Choose another name."));
        return;
      }
      props.onConfirm({ name: trimmed, kind });
    } catch (err: unknown) {
      console.warn("[whiteboard] alias probe failed", err);
      props.onConfirm({ name: trimmed, kind });
    } finally {
      setBusy(false);
    }
  };

  return (
    <orca.components.ModalOverlay visible canClose={!busy} onClose={props.onClose}>
      <div
        className="owb-dialog"
        role="dialog"
        aria-labelledby="owb-sub-board-title"
        onMouseDown={(event: React.MouseEvent) => event.stopPropagation()}
        onKeyDown={(event: React.KeyboardEvent) => {
          if (isComposingKey(event)) return;
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            void submit();
          }
        }}
      >
        <div id="owb-sub-board-title" className="owb-dialog-title">
          {t("New sub-whiteboard")}
        </div>
        <div className="owb-dialog-section">
          <div className="owb-dialog-label">{t("Whiteboard name")}</div>
          <div ref={wrapRef}>
            <orca.components.CompositionInput
              className="owb-board-search"
              value={name}
              autoFocus
              autoComplete="off"
              disabled={busy}
              aria-label={t("Whiteboard name")}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                setName(event.target.value);
                if (error != null) setError(null);
              }}
            />
          </div>
          {error != null ? <div className="owb-dialog-warn">{error}</div> : null}
        </div>
        <div className="owb-dialog-section">
          <div className="owb-dialog-label">{t("Create as")}</div>
          <orca.components.Segmented
            selected={kind}
            options={[
              { value: "page", label: t("As a page") },
              { value: "block", label: t("As a block") },
            ]}
            onChange={(value: string) => {
              if (busy) return;
              if (value === "page" || value === "block") {
                setKind(value);
                if (error != null) setError(null);
              }
            }}
          />
          <div className="owb-dialog-hint">
            {kind === "page"
              ? t("Searchable, and you can link to it with [[name]].")
              : t("Stays under this whiteboard and does not appear in the page list.")}
          </div>
        </div>
        <div className="owb-dialog-actions">
          <orca.components.Button variant="outline" disabled={busy} onClick={props.onClose}>
            {t("Cancel")}
          </orca.components.Button>
          <orca.components.Button
            variant="solid"
            disabled={busy || !usable}
            onClick={() => void submit()}
          >
            {busy ? t("Creating…") : t("Create")}
          </orca.components.Button>
        </div>
      </div>
    </orca.components.ModalOverlay>
  );
}

async function defaultSubBoardName(): Promise<string> {
  const fallback = t("Untitled whiteboard");
  try {
    return await pickFreeAliasName(fallback);
  } catch (err: unknown) {
    console.warn("[whiteboard] alias probe failed", err);
    return fallback;
  }
}

/**
 * One-shot host on document.body — same idea as NamePageDialog, but it does
 * not need load-time mounting. The whiteboard panel has no editor.
 */
export async function requestSubBoard(): Promise<SubBoardDialogResult | null> {
  const defaultName = await defaultSubBoardName();
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "owb-sub-board-host";
    document.body.appendChild(el);
    const root = window.createRoot(el);
    const finish = (value: SubBoardDialogResult | null) => {
      resolve(value);
      root.unmount();
      el.remove();
    };
    root.render(
      <SubBoardDialog
        defaultName={defaultName}
        onClose={() => finish(null)}
        onConfirm={(result) => finish(result)}
      />,
    );
  });
}
