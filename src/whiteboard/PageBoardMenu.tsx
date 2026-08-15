import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  isWhiteboardBlock,
  resolveTargetBlockId,
  turnBackIntoOutline,
  turnIntoWhiteboard,
} from "./pageBoard";
import {
  aliasExists,
  createWhiteboardPage,
  pickFreeAliasName,
} from "./pageBoardCreate";
import { isBlankPageName, normalizePageName } from "./pageBoardPlan";

const { useEffect, useRef, useState } = window.React;

const INSERT_PAGE = "insertWhiteboardPage";
const INSERT_PAGE_SLASH = "insertWhiteboardPageSlash";
const TURN_INTO = "turnIntoWhiteboard";
const TURN_BACK = "turnBackIntoOutline";
const TURN_INTO_MENU = "turnIntoWhiteboardMenu";
const TURN_BACK_MENU = "turnBackIntoOutlineMenu";

export function insertWhiteboardPageCommandId(pluginName: string): string {
  return `${pluginName}.${INSERT_PAGE}`;
}

export function insertWhiteboardPageSlashId(pluginName: string): string {
  return `${pluginName}.${INSERT_PAGE_SLASH}`;
}

export function turnIntoWhiteboardCommandId(pluginName: string): string {
  return `${pluginName}.${TURN_INTO}`;
}

export function turnBackIntoOutlineCommandId(pluginName: string): string {
  return `${pluginName}.${TURN_BACK}`;
}

export function turnIntoWhiteboardMenuId(pluginName: string): string {
  return `${pluginName}.${TURN_INTO_MENU}`;
}

export function turnBackIntoOutlineMenuId(pluginName: string): string {
  return `${pluginName}.${TURN_BACK_MENU}`;
}

function targetBlockOrWarn(explicit?: unknown): DbId | null {
  const id = resolveTargetBlockId(explicit);
  if (id == null) {
    orca.notify("warn", t("Select a block first"));
  }
  return id;
}

export function TurnIntoWhiteboardMenuItem(props: {
  blockId: DbId;
  close: () => void;
}): React.ReactNode {
  const block = orca.state.blocks[props.blockId];
  if (isWhiteboardBlock(block)) return null;
  return (
    <orca.components.MenuText
      title={t("Turn into whiteboard")}
      preIcon="ti ti-chalkboard"
      onClick={() => {
        props.close();
        void turnIntoWhiteboard(props.blockId, orca.state.activePanel);
      }}
    />
  );
}

export function TurnBackIntoOutlineMenuItem(props: {
  blockId: DbId;
  close: () => void;
}): React.ReactNode {
  const block = orca.state.blocks[props.blockId];
  if (!isWhiteboardBlock(block)) return null;
  return (
    <orca.components.MenuText
      title={t("Turn back into outline")}
      preIcon="ti ti-list"
      onClick={() => {
        props.close();
        requestTurnBackConfirm(props.blockId);
      }}
    />
  );
}

type ConfirmReq = { kind: "turnBack"; blockId: DbId };
type NameReq = { kind: "namePage"; defaultName: string };
type HostReq = ConfirmReq | NameReq;

let hostListener: ((req: HostReq) => void) | null = null;
let queued: HostReq | null = null;
let pendingNameResolve: ((name: string | null) => void) | null = null;

function settlePageName(name: string | null): void {
  const resolve = pendingNameResolve;
  pendingNameResolve = null;
  resolve?.(name);
}

function requestTurnBackConfirm(blockId: DbId): void {
  const req: ConfirmReq = { kind: "turnBack", blockId };
  if (hostListener != null) {
    hostListener(req);
    return;
  }
  queued = req;
}

export function requestWhiteboardPageName(
  defaultName: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    settlePageName(null);
    pendingNameResolve = resolve;
    const req: NameReq = { kind: "namePage", defaultName };
    if (hostListener != null) {
      hostListener(req);
      return;
    }
    queued = req;
  });
}

function isComposingKey(event: React.KeyboardEvent): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

function NamePageDialog(props: {
  defaultName: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}): React.ReactNode {
  const [name, setName] = useState(props.defaultName);
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
      if (await aliasExists(trimmed)) {
        setError(
          t("A page with this name already exists. Choose another name."),
        );
        return;
      }
      props.onConfirm(trimmed);
    } catch (err: unknown) {
      console.warn("[whiteboard] alias probe failed", err);
      props.onConfirm(trimmed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <orca.components.ModalOverlay
      visible
      canClose={!busy}
      onClose={props.onClose}
    >
      <div
        className="owb-dialog"
        role="dialog"
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
        <div className="owb-dialog-title">{t("New whiteboard page")}</div>
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
          {error != null ? (
            <div className="owb-dialog-warn">{error}</div>
          ) : null}
        </div>
        <div className="owb-dialog-actions">
          <orca.components.Button
            variant="outline"
            disabled={busy}
            onClick={props.onClose}
          >
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

function TurnBackConfirmDialog(props: {
  blockId: DbId;
  onClose: () => void;
}): React.ReactNode {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await turnBackIntoOutline(props.blockId);
      props.onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <orca.components.ModalOverlay visible canClose={!busy} onClose={props.onClose}>
      <div className="owb-dialog" role="dialog">
        <div className="owb-dialog-title">{t("Turn back into outline")}</div>
        <div className="owb-dialog-section">
          <div className="owb-dialog-hint">
            {t(
              "Turn this whiteboard back into an outline? The canvas layout stays on this block, so you can turn it into a whiteboard again later.",
            )}
          </div>
        </div>
        <div className="owb-dialog-actions">
          <orca.components.Button
            variant="outline"
            disabled={busy}
            onClick={props.onClose}
          >
            {t("Cancel")}
          </orca.components.Button>
          <orca.components.Button
            variant="dangerous"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {t("Turn back into outline")}
          </orca.components.Button>
        </div>
      </div>
    </orca.components.ModalOverlay>
  );
}

function PageBoardHost(): React.ReactNode {
  const [req, setReq] = useState<HostReq | null>(null);

  useEffect(() => {
    hostListener = (next) => setReq(next);
    if (queued != null) {
      setReq(queued);
      queued = null;
    }
    return () => {
      hostListener = null;
      settlePageName(null);
    };
  }, []);

  if (req == null) return null;
  if (req.kind === "namePage") {
    return (
      <NamePageDialog
        defaultName={req.defaultName}
        onClose={() => {
          settlePageName(null);
          setReq(null);
        }}
        onConfirm={(name) => {
          settlePageName(name);
          setReq(null);
        }}
      />
    );
  }
  return (
    <TurnBackConfirmDialog
      blockId={req.blockId}
      onClose={() => setReq(null)}
    />
  );
}

export function mountPageBoardHost(): () => void {
  const el = document.createElement("div");
  el.className = "owb-page-board-host";
  document.body.appendChild(el);
  const root = window.createRoot(el);
  root.render(<PageBoardHost />);
  return () => {
    root.unmount();
    el.remove();
  };
}

export function registerPageBoardCommands(pluginName: string): void {
  const insertId = insertWhiteboardPageCommandId(pluginName);
  orca.commands.registerEditorCommand(
    insertId,
    async ([panelId, _rootBlockId, cursor]) => {
      let defaultName = t("Untitled whiteboard");
      try {
        defaultName = await pickFreeAliasName(defaultName);
      } catch (err: unknown) {
        console.warn("[whiteboard] alias probe failed", err);
      }
      const name = await requestWhiteboardPageName(defaultName);
      if (name == null) return null;
      await createWhiteboardPage(panelId, cursor, name);
      return null;
    },
    () => {},
    { label: t("New whiteboard page"), noFocusNeeded: true },
  );
  orca.slashCommands.registerSlashCommand(
    insertWhiteboardPageSlashId(pluginName),
    {
      icon: "ti ti-chalkboard",
      group: t("Insert"),
      title: t("New whiteboard page"),
      command: insertId,
    },
  );

  const turnIntoId = turnIntoWhiteboardCommandId(pluginName);
  orca.commands.registerCommand(
    turnIntoId,
    (blockId?: unknown) => {
      const id = targetBlockOrWarn(blockId);
      if (id == null) return;
      void turnIntoWhiteboard(id, orca.state.activePanel);
    },
    t("Turn into whiteboard"),
  );

  const turnBackId = turnBackIntoOutlineCommandId(pluginName);
  orca.commands.registerCommand(
    turnBackId,
    (blockId?: unknown) => {
      const id = targetBlockOrWarn(blockId);
      if (id == null) return;
      const block = orca.state.blocks[id];
      if (!isWhiteboardBlock(block)) {
        orca.notify("info", t("This is not a whiteboard"));
        return;
      }
      requestTurnBackConfirm(id);
    },
    t("Turn back into outline"),
  );

  orca.blockMenuCommands.registerBlockMenuCommand(
    turnIntoWhiteboardMenuId(pluginName),
    {
      worksOnMultipleBlocks: false,
      render: (blockId, _rootBlockId, close) => (
        <TurnIntoWhiteboardMenuItem blockId={blockId} close={close} />
      ),
    },
  );
  orca.blockMenuCommands.registerBlockMenuCommand(
    turnBackIntoOutlineMenuId(pluginName),
    {
      worksOnMultipleBlocks: false,
      render: (blockId, _rootBlockId, close) => (
        <TurnBackIntoOutlineMenuItem blockId={blockId} close={close} />
      ),
    },
  );
}

export function unregisterPageBoardCommands(pluginName: string): void {
  orca.commands.unregisterEditorCommand(
    insertWhiteboardPageCommandId(pluginName),
  );
  orca.slashCommands.unregisterSlashCommand(
    insertWhiteboardPageSlashId(pluginName),
  );
  orca.commands.unregisterCommand(turnIntoWhiteboardCommandId(pluginName));
  orca.commands.unregisterCommand(turnBackIntoOutlineCommandId(pluginName));
  orca.blockMenuCommands.unregisterBlockMenuCommand(
    turnIntoWhiteboardMenuId(pluginName),
  );
  orca.blockMenuCommands.unregisterBlockMenuCommand(
    turnBackIntoOutlineMenuId(pluginName),
  );
}
