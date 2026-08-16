import {
  findOpenMediaReaderPanel,
  isMediaHighlightRefClick,
  isMediaReaderBlock,
  resolveMediaRefVArgs,
  writeMediaReaderAnchor,
  type MediaRefBlockMap,
  type MediaRefSourceBlock,
} from "./mediaRefJump.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const PDF_ID = 900;
const REF_A = 11;
const REF_B = 12;

function source(partial: MediaRefSourceBlock): MediaRefSourceBlock {
  return partial;
}

function blocksWith(
  sourceBlock: MediaRefSourceBlock,
  sourceId = 1,
): MediaRefBlockMap {
  return { [sourceId]: sourceBlock };
}

// 1. One 📌 to this PDF → its vArgs.
{
  const page3 = { page: 3, x: 0.21, y: 0.44 };
  const got = resolveMediaRefVArgs(
    blocksWith(
      source({
        content: [{ t: "r", v: REF_A, a: "📌", vArgs: page3 }],
        refs: [{ id: REF_A, to: PDF_ID }],
      }),
    ),
    1,
    PDF_ID,
    0,
  );
  check(got === page3, "single pin returns that fragment's vArgs");
  check(got != null && got.page === 3, "single pin keeps page 3");
}

// 2. Two 📌 to the same PDF → index picks the matching page.
{
  const first = { page: 2, x: 0.1, y: 0.2 };
  const second = { page: 8, x: 0.5, y: 0.6 };
  const map = blocksWith(
    source({
      content: [
        { t: "t", v: "before" },
        { t: "r", v: REF_A, a: "📌", vArgs: first },
        { t: "t", v: "mid" },
        { t: "r", v: REF_B, a: "📌", vArgs: second },
      ],
      refs: [
        { id: REF_A, to: PDF_ID },
        { id: REF_B, to: PDF_ID },
      ],
    }),
  );
  const a = resolveMediaRefVArgs(map, 1, PDF_ID, 0);
  const b = resolveMediaRefVArgs(map, 1, PDF_ID, 1);
  check(a != null && a.page === 2, "index 0 is the first pin (page 2)");
  check(b != null && b.page === 8, "index 1 is the second pin (page 8)");
  check(a !== b, "the two pins are distinct vArgs objects");
}

// 3. Ordinary block ref with no vArgs → null.
{
  const got = resolveMediaRefVArgs(
    blocksWith(
      source({
        content: [{ t: "r", v: REF_A }],
        refs: [{ id: REF_A, to: PDF_ID }],
      }),
    ),
    1,
    PDF_ID,
    0,
  );
  check(got == null, "plain ref without vArgs is not a media highlight");
}

// 4. Missing source / empty content / unknown ref id → null, no throw.
{
  check(
    resolveMediaRefVArgs(undefined, 1, PDF_ID, 0) == null,
    "undefined blocks map returns null",
  );
  check(
    resolveMediaRefVArgs(null, 1, PDF_ID, 0) == null,
    "null blocks map returns null",
  );
  check(
    resolveMediaRefVArgs({}, 1, PDF_ID, 0) == null,
    "missing source block returns null",
  );
  check(
    resolveMediaRefVArgs(
      blocksWith(source({ content: [], refs: [{ id: REF_A, to: PDF_ID }] })),
      1,
      PDF_ID,
      0,
    ) == null,
    "empty content returns null",
  );
  check(
    resolveMediaRefVArgs(
      blocksWith(source({ refs: [{ id: REF_A, to: PDF_ID }] })),
      1,
      PDF_ID,
      0,
    ) == null,
    "missing content returns null",
  );
  check(
    resolveMediaRefVArgs(
      blocksWith(
        source({
          content: [{ t: "r", v: REF_A, vArgs: { page: 1, x: 0, y: 0 } }],
          refs: [{ id: 99, to: PDF_ID }],
        }),
      ),
      1,
      PDF_ID,
      0,
    ) == null,
    "frag.v not found in refs returns null",
  );
}

// EPUB cfi travels through unchanged.
{
  const cfi = { cfi: "epubcfi(/6/14!/4/2/2)" };
  const got = resolveMediaRefVArgs(
    blocksWith(
      source({
        content: [{ t: "r", v: REF_A, vArgs: cfi }],
        refs: [{ id: REF_A, to: 77 }],
      }),
    ),
    1,
    77,
    0,
  );
  check(got === cfi, "epub cfi vArgs is returned as-is");
}

// Media type detection.
{
  check(
    isMediaReaderBlock({
      properties: [{ name: "_repr", value: { type: "pdf" } }],
    }),
    "pdf property is a media block",
  );
  check(
    isMediaReaderBlock({ _repr: { type: "epub" } }),
    "epub hidden _repr is a media block",
  );
  check(
    isMediaReaderBlock({
      properties: [{ name: "_repr", value: { type: "text" } }],
    }) === false,
    "text block is not media",
  );
  check(isMediaReaderBlock(undefined) === false, "missing block is not media");
  check(isMediaReaderBlock(null) === false, "null block is not media");
}

// Open reader panel: first matching leaf, skip cover / nested containers.
{
  const tree = {
    id: "root",
    direction: "row",
    children: [
      {
        id: "col",
        direction: "column",
        children: [
          {
            id: "cover",
            view: "block",
            viewArgs: { blockId: PDF_ID, view: "preview" },
            viewState: {},
          },
          {
            id: "reader",
            view: "block",
            viewArgs: { blockId: PDF_ID, view: "normal" },
            viewState: {},
          },
        ],
      },
      {
        id: "board",
        view: "whiteboard.board",
        viewArgs: { blockId: 1 },
        viewState: {},
      },
    ],
  };
  const found = findOpenMediaReaderPanel(tree, PDF_ID);
  check(found != null && found.viewArgs?.view === "normal", "picks normal view");
  check(
    (found as { id?: string } | null)?.id === "reader",
    "skips the cover panel and containers",
  );
  check(
    findOpenMediaReaderPanel(tree, 12345) == null,
    "missing media panel is null",
  );
  check(findOpenMediaReaderPanel(undefined, PDF_ID) == null, "no tree is null");
  check(
    findOpenMediaReaderPanel({ id: "leaf", view: "block" }, PDF_ID) == null,
    "missing viewArgs is null, not a throw",
  );
}

// Writing anchor mutates the live slot.
{
  const panel = { viewState: {} as Record<string, unknown> };
  const vArgs = { page: 4, x: 0.2, y: 0.3 };
  check(
    writeMediaReaderAnchor(panel, PDF_ID, vArgs) === true,
    "write succeeds on a live panel",
  );
  const slot = panel.viewState[String(PDF_ID)] as { anchor?: unknown };
  check(slot != null && slot.anchor === vArgs, "anchor is the given vArgs");
  check(
    writeMediaReaderAnchor(undefined, PDF_ID, vArgs) === false,
    "missing panel does not throw",
  );
  check(
    writeMediaReaderAnchor({ viewState: undefined }, PDF_ID, vArgs) === false,
    "missing viewState does not throw",
  );
}

// --- isMediaHighlightRefClick ----------------------------------------------

type FakeElInit = {
  className?: string;
  attrs?: Record<string, string>;
};

class FakeEl {
  parent: FakeEl | null = null;
  children: FakeEl[] = [];
  className: string;
  attrs: Record<string, string>;
  dataset: Record<string, string> = {};

  constructor(init: FakeElInit = {}) {
    this.className = init.className ?? "";
    this.attrs = { ...(init.attrs ?? {}) };
    for (const [key, value] of Object.entries(this.attrs)) {
      if (!key.startsWith("data-")) continue;
      const camel = key
        .slice(5)
        .replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
      this.dataset[camel] = value;
    }
  }

  append(child: FakeEl): FakeEl {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }

  closest(sel: string): FakeEl | null {
    let cur: FakeEl | null = this;
    while (cur != null) {
      if (fakeMatches(cur, sel)) return cur;
      cur = cur.parent;
    }
    return null;
  }

  querySelectorAll(sel: string): FakeEl[] {
    const out: FakeEl[] = [];
    const walk = (node: FakeEl): void => {
      for (const child of node.children) {
        if (fakeMatches(child, sel)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }
}

function fakeMatches(el: FakeEl, sel: string): boolean {
  return sel.split(",").some((part) => fakeMatchesOne(el, part.trim()));
}

function fakeMatchesOne(el: FakeEl, sel: string): boolean {
  const tokenRe =
    /(\.[A-Za-z0-9_-]+)|\[([A-Za-z0-9_-]+)(?:=['"]?([^\]'"]*)['"]?)?\]/g;
  let matched = false;
  let token: RegExpExecArray | null;
  while ((token = tokenRe.exec(sel)) != null) {
    matched = true;
    if (token[1] != null) {
      const cls = token[1].slice(1);
      if (!el.className.split(/\s+/).includes(cls)) return false;
    } else if (token[2] != null) {
      const value = el.attrs[token[2]];
      if (token[3] != null) {
        if (value !== token[3]) return false;
      } else if (value == null) {
        return false;
      }
    }
  }
  return matched;
}

function rowWithRef(mediaBlockId: number, sourceBlockId = 1): FakeEl {
  const row = new FakeEl({
    className: "owb-card-block-node",
    attrs: { "data-block-id": String(sourceBlockId) },
  });
  const refEl = new FakeEl({
    attrs: { "data-type": "r", "data-ref": String(mediaBlockId) },
  });
  const clickTarget = new FakeEl();
  row.append(refEl);
  refEl.append(clickTarget);
  return clickTarget;
}

function installOrcaBlocks(blocks: MediaRefBlockMap): void {
  const g = globalThis as typeof globalThis & {
    orca?: { state: { blocks: MediaRefBlockMap } };
  };
  g.orca = { state: { blocks } };
}

{
  const page3 = { page: 3, x: 0.21, y: 0.44 };
  installOrcaBlocks({
    1: source({
      content: [{ t: "r", v: REF_A, a: "📌", vArgs: page3 }],
      refs: [{ id: REF_A, to: PDF_ID }],
    }),
    [PDF_ID]: { _repr: { type: "pdf" } } as MediaRefSourceBlock,
  });
  check(
    isMediaHighlightRefClick(rowWithRef(PDF_ID) as unknown as EventTarget) ===
      true,
    "PDF ref with vArgs is taken over by mediaRefJump",
  );
}

{
  installOrcaBlocks({
    1: source({
      content: [{ t: "r", v: REF_A }],
      refs: [{ id: REF_A, to: PDF_ID }],
    }),
    [PDF_ID]: { _repr: { type: "pdf" } } as MediaRefSourceBlock,
  });
  check(
    isMediaHighlightRefClick(rowWithRef(PDF_ID) as unknown as EventTarget) ===
      false,
    "PDF ref without vArgs is not a media highlight",
  );
}

{
  installOrcaBlocks({
    1: source({
      content: [{ t: "r", v: REF_A, a: "📌", vArgs: { page: 1, x: 0, y: 0 } }],
      refs: [{ id: REF_A, to: 55 }],
    }),
    55: { _repr: { type: "text" } } as MediaRefSourceBlock,
  });
  check(
    isMediaHighlightRefClick(rowWithRef(55) as unknown as EventTarget) ===
      false,
    "plain text block ref is not a media highlight",
  );
}

console.log("mediaRefJump tests passed");
