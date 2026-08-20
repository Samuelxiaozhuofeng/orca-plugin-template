import {
  handleWhiteboardKey,
  isEditableTarget,
  isWhiteboardShortcutTarget,
  type WhiteboardKeyActions,
} from "./canvasKeys.ts";

function check(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

class FakeNode {}
const g = globalThis as unknown as {
  orca?: { state: { activePanel: string } };
  document?: { activeElement: null; body: null };
  HTMLElement?: typeof FakeNode;
  Element?: typeof FakeNode;
  Node?: typeof FakeNode;
};
g.orca = { state: { activePanel: "panel-a" } };
g.HTMLElement = FakeNode;
g.Element = FakeNode;
g.Node = FakeNode;
if (typeof document === "undefined") {
  g.document = { activeElement: null, body: null };
}

function event(
  key: string,
  extra: Partial<KeyboardEvent> & { code?: string } = {},
): KeyboardEvent {
  return {
    key,
    code: extra.code ?? "",
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    preventDefault() {
      (this as { defaultPrevented: boolean }).defaultPrevented = true;
    },
    defaultPrevented: false,
    ...extra,
  } as KeyboardEvent;
}

function actions(): WhiteboardKeyActions & {
  log: string[];
} {
  const log: string[] = [];
  return {
    log,
    nudge: (dx, dy) => log.push(`nudge:${dx},${dy}`),
    selectAll: () => log.push("selectAll"),
    escape: () => log.push("escape"),
    remove: (opts) =>
      log.push(`remove:${opts?.permanent === true ? "permanent" : "default"}`),
    undo: () => log.push("undo"),
    redo: () => log.push("redo"),
    find: () => log.push("find"),
    zoomIn: () => log.push("zoomIn"),
    zoomOut: () => log.push("zoomOut"),
    fit: () => log.push("fit"),
    color: (id) => log.push(`color:${id ?? "none"}`),
  };
}

check(isEditableTarget(null) === false, "null is not editable");

const input = Object.assign(new FakeNode(), {
  tagName: "INPUT",
  isContentEditable: false,
  closest: () => null,
});
check(
  isEditableTarget(input as unknown as EventTarget) === true,
  "input is an editable target",
);
const whileTyping = actions();
if (
  isWhiteboardShortcutTarget(
    event("1", { target: input as unknown as EventTarget }),
    { panelId: "panel-a", editing: false, viewport: null },
  )
) {
  handleWhiteboardKey(event("1"), whileTyping);
}
check(whileTyping.log.length === 0, "colour key does not fire in an input");

check(
  isWhiteboardShortcutTarget(event("f"), {
    panelId: "panel-a",
    editing: true,
    viewport: null,
  }) === false,
  "editing blocks every shortcut",
);

check(
  isWhiteboardShortcutTarget(event("1"), {
    panelId: "panel-a",
    editing: false,
    viewport: null,
    searchOpen: true,
  }) === false,
  "search overlay blocks canvas keys",
);

check(
  isWhiteboardShortcutTarget(event("+"), {
    panelId: "panel-b",
    editing: false,
    viewport: null,
  }) === false,
  "inactive panel does not take keys",
);

check(
  isWhiteboardShortcutTarget(event("f"), {
    panelId: "panel-a",
    editing: false,
    viewport: null,
  }) === true,
  "idle canvas accepts shortcuts",
);
check(
  isWhiteboardShortcutTarget(
    { target: null },
    { panelId: "panel-a", editing: false, viewport: null },
  ) === true,
  "idle canvas accepts generic event target (e.g. paste event)",
);

const zoom = actions();
check(handleWhiteboardKey(event("+"), zoom), "+ zooms in");
check(handleWhiteboardKey(event("="), zoom), "= zooms in");
check(handleWhiteboardKey(event("-"), zoom), "- zooms out");
check(zoom.log.join(",") === "zoomIn,zoomIn,zoomOut", "zoom keys fire in order");

const fit = actions();
check(handleWhiteboardKey(event("f"), fit), "f fits");
check(handleWhiteboardKey(event("F"), fit), "F fits");
check(fit.log.join(",") === "fit,fit", "F is fit, not colour");

const paint = actions();
check(handleWhiteboardKey(event("1"), paint), "1 paints blue");
check(handleWhiteboardKey(event("0"), paint), "0 clears colour");
check(handleWhiteboardKey(event("5"), paint), "5 paints purple");
check(
  paint.log.join(",") === "color:blue,color:none,color:purple",
  "digit keys map to colours",
);

const find = actions();
check(
  handleWhiteboardKey(event("f", { metaKey: true }), find) === false,
  "⌘F is not handled by canvas keys",
);
check(
  handleWhiteboardKey(event("f", { ctrlKey: true }), find) === false,
  "Ctrl+F is not handled by canvas keys",
);
check(find.log.length === 0, "modifier+F no longer opens find here");

const hostZoom = actions();
check(
  handleWhiteboardKey(event("=", { metaKey: true }), hostZoom) === false,
  "⌘= is left for the host",
);
check(hostZoom.log.length === 0, "⌘= does not zoom the board");

const whileEditing = actions();
if (
  isWhiteboardShortcutTarget(event("1"), {
    panelId: "panel-a",
    editing: true,
    viewport: null,
  })
) {
  handleWhiteboardKey(event("1"), whileEditing);
}
check(whileEditing.log.length === 0, "colour key does not fire while editing");

const whileSearch = actions();
if (
  isWhiteboardShortcutTarget(event("-"), {
    panelId: "panel-a",
    editing: false,
    viewport: null,
    searchOpen: true,
  })
) {
  handleWhiteboardKey(event("-"), whileSearch);
}
check(whileSearch.log.length === 0, "zoom does not fire while search is open");

// Presentation mode keys
const presentLog: string[] = [];
const presentActions = {
  ...actions(),
  present: {
    next: () => presentLog.push("next"),
    prev: () => presentLog.push("prev"),
    nextCard: () => presentLog.push("nextCard"),
    prevCard: () => presentLog.push("prevCard"),
    toggleZoom: () => presentLog.push("toggleZoom"),
    exit: () => presentLog.push("exit"),
    firstSlide: () => presentLog.push("firstSlide"),
    lastSlide: () => presentLog.push("lastSlide"),
  },
};

check(handleWhiteboardKey(event("ArrowRight"), presentActions) === true, "ArrowRight calls next");
check(handleWhiteboardKey(event("PageDown"), presentActions) === true, "PageDown calls next");
check(handleWhiteboardKey(event(" ", { code: "Space" }), presentActions) === true, "Space calls next");
check(handleWhiteboardKey(event("ArrowLeft"), presentActions) === true, "ArrowLeft calls prev");
check(handleWhiteboardKey(event("PageUp"), presentActions) === true, "PageUp calls prev");
check(handleWhiteboardKey(event("ArrowDown"), presentActions) === true, "ArrowDown calls nextCard");
check(handleWhiteboardKey(event("ArrowUp"), presentActions) === true, "ArrowUp calls prevCard");
check(handleWhiteboardKey(event("Enter"), presentActions) === true, "Enter calls toggleZoom");
check(handleWhiteboardKey(event("Escape"), presentActions) === true, "Escape calls exit");
check(handleWhiteboardKey(event("Home"), presentActions) === true, "Home calls firstSlide");
check(handleWhiteboardKey(event("End"), presentActions) === true, "End calls lastSlide");

check(
  presentLog.join(",") ===
    "next,next,next,prev,prev,nextCard,prevCard,toggleZoom,exit,firstSlide,lastSlide",
  "presentation shortcuts fire in order and do not trigger nudge/escape",
);
// In presentation mode: other keys (e.g. undo, color, delete, fit, selectAll) are disabled (return false)
check(handleWhiteboardKey(event("1"), presentActions) === false, "1 does not paint in presentation mode");
check(handleWhiteboardKey(event("f"), presentActions) === false, "f does not fit in presentation mode");
check(handleWhiteboardKey(event("Delete"), presentActions) === false, "Delete is disabled in presentation mode");
check(handleWhiteboardKey(event("a", { metaKey: true }), presentActions) === false, "Cmd+A is disabled in presentation mode");
check(handleWhiteboardKey(event("+"), presentActions) === true, "+ still zooms in presentation mode");
check(handleWhiteboardKey(event("-"), presentActions) === true, "- still zooms in presentation mode");
check(
  presentActions.log.join(",") === "zoomIn,zoomOut",
  "only zoom keys executed on base actions in presentation mode",
);

// Non-presentation mode: Enter is not intercepted
const nonPresent = actions();
check(
  handleWhiteboardKey(event("Enter"), nonPresent) === false,
  "Enter is not handled outside presentation mode",
);

// Delete / Backspace keys (regular vs Shift)
const removeDefault = actions();
check(
  handleWhiteboardKey(event("Delete"), removeDefault) === true,
  "Delete calls remove",
);
check(
  handleWhiteboardKey(event("Backspace"), removeDefault) === true,
  "Backspace calls remove",
);
check(
  removeDefault.log.join(",") === "remove:default,remove:default",
  "Delete and Backspace trigger default removal",
);

const removePermanent = actions();
check(
  handleWhiteboardKey(
    event("Delete", { shiftKey: true }),
    removePermanent,
  ) === true,
  "Shift+Delete calls remove with permanent",
);
check(
  handleWhiteboardKey(
    event("Backspace", { shiftKey: true }),
    removePermanent,
  ) === true,
  "Shift+Backspace calls remove with permanent",
);
check(
  removePermanent.log.join(",") === "remove:permanent,remove:permanent",
  "Shift+Delete and Shift+Backspace trigger permanent removal",
);

console.log("canvasKeys tests passed");


