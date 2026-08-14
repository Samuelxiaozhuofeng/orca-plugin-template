import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { onBoardCardsChanged } from "./boardEvents";
import { fetchWhiteboardBlocks } from "./boards";
import { boardName, readCards } from "./data";
import { readWhiteboardSettings } from "./settings";

export const BLOCK_MARKS_CSS_ROLE = "whiteboard.blockmarks.styles";

const DEBOUNCE_MS = 300;
const SELECTOR_CHUNK = 80;

const { subscribe } = window.Valtio as {
  subscribe: (proxyObject: object, callback: () => void) => () => void;
};

let pluginName = "";
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeCards: (() => void) | null = null;
let unsubscribeSettings: (() => void) | null = null;
let rebuildSeq = 0;
let lastEnabled: boolean | undefined;

export function startBlockMarks(name: string): void {
  stopBlockMarks();
  pluginName = name;
  lastEnabled = marksEnabled();
  unsubscribeCards = onBoardCardsChanged(() => scheduleRebuild());
  unsubscribeSettings = subscribe(orca.state.plugins, onPluginsChanged);
  void rebuildBlockMarks();
}

export function stopBlockMarks(): void {
  if (debounceTimer != null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  unsubscribeCards?.();
  unsubscribeCards = null;
  unsubscribeSettings?.();
  unsubscribeSettings = null;
  lastEnabled = undefined;
  pluginName = "";
  removeBlockMarkStyles();
}

function onPluginsChanged(): void {
  const enabled = marksEnabled();
  if (enabled === lastEnabled) return;
  lastEnabled = enabled;
  if (enabled) {
    void rebuildBlockMarks();
    return;
  }
  removeBlockMarkStyles();
}

function scheduleRebuild(): void {
  if (debounceTimer != null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void rebuildBlockMarks();
  }, DEBOUNCE_MS);
}

async function rebuildBlockMarks(): Promise<void> {
  const seq = ++rebuildSeq;
  try {
    if (!marksEnabled()) {
      removeBlockMarkStyles();
      return;
    }
    const boards = await fetchWhiteboardBlocks();
    if (seq !== rebuildSeq) return;
    if (!marksEnabled()) {
      removeBlockMarkStyles();
      return;
    }
    const css = buildBlockMarkCss(collectCardBoards(boards));
    if (css === "") {
      removeBlockMarkStyles();
      return;
    }
    orca.themes.injectCSS(css, BLOCK_MARKS_CSS_ROLE);
  } catch (err) {
    console.error("[whiteboard] failed to rebuild block marks", err);
  }
}

function removeBlockMarkStyles(): void {
  orca.themes.removeCSS(BLOCK_MARKS_CSS_ROLE);
}

function marksEnabled(): boolean {
  if (!pluginName) return false;
  return readWhiteboardSettings(
    orca.state.plugins[pluginName]?.settings as
      | Record<string, unknown>
      | undefined,
  ).markOutlineBlocks;
}

function collectCardBoards(boards: readonly Block[]): Map<DbId, string[]> {
  const byBlock = new Map<DbId, string[]>();
  for (const board of boards) {
    const name = boardName(board);
    const seen = new Set<DbId>();
    for (const card of readCards(board)) {
      if (seen.has(card.blockId)) continue;
      seen.add(card.blockId);
      const names = byBlock.get(card.blockId);
      if (names) names.push(name);
      else byBlock.set(card.blockId, [name]);
    }
  }
  return byBlock;
}

export function cssQuoted(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (ch === "\n") out += "\\A ";
    else if (ch === "\r") out += "\\00000D ";
    else if (code < 0x20) {
      out += `\\${code.toString(16).padStart(6, "0")} `;
    } else {
      out += ch;
    }
  }
  return `"${out}"`;
}

function tooltipFor(names: readonly string[]): string {
  if (names.length === 1) {
    return t('On the "${name}" whiteboard', { name: names[0] });
  }
  return t("On ${count} whiteboards", { count: String(names.length) });
}

function selectorChunks(ids: readonly DbId[], suffix: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < ids.length; i += SELECTOR_CHUNK) {
    chunks.push(
      ids
        .slice(i, i + SELECTOR_CHUNK)
        .map((id) => `.orca-block[data-id="${id}"]${suffix}`)
        .join(",\n"),
    );
  }
  return chunks;
}

export function buildBlockMarkCss(byBlock: Map<DbId, string[]>): string {
  if (byBlock.size === 0) return "";
  const ids = [...byBlock.keys()].sort((a, b) => a - b);
  const parts: string[] = [
    `:root {
  --owb-block-mark-shift: calc(var(--orca-spacing-xl) + 1.8rem);
}`,
  ];

  for (const group of selectorChunks(ids, "::after")) {
    parts.push(`${group} {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  translate: var(--owb-block-mark-shift);
  box-sizing: border-box;
  width: 12px;
  height: 9px;
  border: 1.5px solid var(--orca-color-primary-5, #2F80ED);
  border-radius: 2px;
  background: linear-gradient(
      var(--orca-color-primary-5, #2F80ED),
      var(--orca-color-primary-5, #2F80ED)
    )
    center / 6px 1.5px no-repeat;
  pointer-events: none;
  opacity: 0.55;
}`);
  }

  const hoverMain = ":has(> .orca-repr > .orca-repr-main:hover)";
  for (const group of selectorChunks(ids, `${hoverMain}::after`)) {
    parts.push(`${group} {
  opacity: 1;
}`);
  }

  for (const group of selectorChunks(ids, `${hoverMain}::before`)) {
    parts.push(`${group} {
  position: absolute;
  top: 0;
  right: 0;
  /* Sit just left of the mark: the row's right margin is narrow, so growing
     rightwards would run the label off the panel. */
  translate: calc(var(--owb-block-mark-shift) - 0.5rem);
  transform: translateX(-100%);
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--orca-color-bg-2);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
  white-space: pre;
  color: var(--orca-color-text-2);
  pointer-events: none;
  z-index: 2;
}`);
  }

  for (const id of ids) {
    const names = byBlock.get(id);
    if (names == null) continue;
    parts.push(
      `.orca-block[data-id="${id}"]${hoverMain}::before {
  content: ${cssQuoted(tooltipFor(names))};
}`,
    );
  }

  return parts.join("\n\n");
}
