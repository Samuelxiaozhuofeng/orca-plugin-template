import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { canRedo, canUndo } from "./boardHistory";
import { BoardTitle } from "./BoardTitle";
import { boardName, clampScale } from "./data";
import {
  DEFAULT_VIEW,
  type CanvasView,
} from "./viewTransform";

type Props = {
  blockId: DbId;
  block: Block | undefined;
  historyTick: number;
  busy: boolean;
  zoomLabelRef: { current: HTMLButtonElement | null };
  onUndo: () => void;
  onRedo: () => void;
  onPlace: () => void;
  setView: (
    next: CanvasView | ((current: CanvasView) => CanvasView),
  ) => void;
};

export function BoardToolbar({
  blockId,
  block,
  historyTick,
  busy,
  zoomLabelRef,
  onUndo,
  onRedo,
  onPlace,
  setView,
}: Props) {
  return (
    <div className="owb-toolbar">
      <BoardTitle blockId={blockId} name={boardName(block)} />
      <div className="owb-toolbar-sep" />
      <button
        type="button"
        className="owb-toolbar-btn"
        disabled={historyTick < 0 || !canUndo(blockId)}
        title={t("Undo")}
        onClick={onUndo}
      >
        <i className="ti ti-arrow-back-up" />
      </button>
      <button
        type="button"
        className="owb-toolbar-btn"
        disabled={historyTick < 0 || !canRedo(blockId)}
        title={t("Redo")}
        onClick={onRedo}
      >
        <i className="ti ti-arrow-forward-up" />
      </button>
      <div className="owb-toolbar-sep" />
      <button
        type="button"
        className="owb-toolbar-btn"
        disabled={busy}
        onClick={onPlace}
      >
        {t("Place journals…")}
      </button>
      <div className="owb-toolbar-sep" />
      <div className="owb-zoom">
        <button
          type="button"
          className="owb-zoom-btn"
          onClick={() =>
            setView((current: CanvasView) => ({
              ...current,
              scale: clampScale(current.scale / 1.1),
            }))
          }
        >
          −
        </button>
        <div className="owb-zoom-sep" />
        <button
          type="button"
          className="owb-zoom-btn"
          ref={zoomLabelRef}
          title={t("Reset view")}
          onClick={() => setView(DEFAULT_VIEW)}
        />
        <div className="owb-zoom-sep" />
        <button
          type="button"
          className="owb-zoom-btn"
          onClick={() =>
            setView((current: CanvasView) => ({
              ...current,
              scale: clampScale(current.scale * 1.1),
            }))
          }
        >
          +
        </button>
      </div>
    </div>
  );
}
