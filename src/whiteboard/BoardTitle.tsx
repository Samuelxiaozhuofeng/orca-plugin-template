import type { Block, ContentFragment, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { cacheBlockList } from "./newCard";

const { useEffect, useRef, useState } = window.React;

function cacheReturnedBlocks(result: unknown): void {
  if (Array.isArray(result)) cacheBlockList(result[1]);
}

function isComposingKey(event: React.KeyboardEvent): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

async function writeBoardTitle(blockId: DbId, name: string): Promise<void> {
  const content: ContentFragment[] = [{ t: "t", v: name }];
  const block = orca.state.blocks[blockId] as Block | undefined;
  const text = await orca.converters.blockConvert(
    "plain",
    { content },
    { type: "text" },
    block,
  );
  const result = await orca.invokeBackend("set-blocks-content", [
    {
      id: blockId,
      content,
      text,
      modified: new Date(),
    },
  ]);
  cacheReturnedBlocks(result);
  const live = orca.state.blocks[blockId];
  if (live != null) {
    live.content = content;
    live.text = text;
    live.modified = new Date();
  }
  orca.broadcasts.broadcast("orca.refresh-blocks", [blockId]);
}

export function BoardTitle({
  blockId,
  name,
}: {
  blockId: DbId;
  name: string;
}): React.ReactNode {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const skipBlurRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [editing, name]);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (el == null) return;
    el.focus();
    el.select();
  }, [editing]);

  const startEdit = () => {
    if (saving) return;
    skipBlurRef.current = false;
    setDraft(name);
    setEditing(true);
  };

  const cancel = () => {
    skipBlurRef.current = true;
    setDraft(name);
    setEditing(false);
  };

  const commit = async () => {
    const next = draft.trim();
    if (next === "") {
      setDraft(name);
      setEditing(false);
      return;
    }
    if (next === name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await writeBoardTitle(blockId, next);
      setEditing(false);
    } catch (error) {
      console.error("[whiteboard] failed to rename board", error);
      orca.notify(
        "error",
        error instanceof Error ? error.message : t("Failed to rename whiteboard"),
      );
      setDraft(name);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposingKey(event)) return;
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      skipBlurRef.current = true;
      void commit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    }
  };

  const onBlur = () => {
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    void commit();
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="owb-toolbar-title-input"
        type="text"
        value={draft}
        disabled={saving}
        aria-label={t("Whiteboard name")}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          setDraft(event.target.value)
        }
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      />
    );
  }

  return (
    <button
      type="button"
      className="owb-toolbar-title"
      title={t("Rename whiteboard")}
      onClick={startEdit}
    >
      {name}
    </button>
  );
}
