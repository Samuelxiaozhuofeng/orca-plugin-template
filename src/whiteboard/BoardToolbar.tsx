import type { Block, DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { canRedo, canUndo } from "./boardHistory";
import { BoardTitle } from "./BoardTitle";
import { boardName } from "./data";
import { nextZoomScale } from "./fitView";
import { openBoardAsOutline } from "./pageBoardRedirect";
import { CardFilterPopover } from "./CardFilterPopover";
import { invokeSlideOutlineOnActivePanel } from "./slideOutlineAction.ts";
import { useCardFilterControls } from "./useCardFilter";
import {
  DEFAULT_VIEW,
  type CanvasView,
} from "./viewTransform";

const { useEffect, useRef } = window.React;

type Props = {
  blockId: DbId;
  block: Block | undefined;
  historyTick: number;
  busy: boolean;
  zoomLabelRef: { current: HTMLButtonElement | null };
  onUndo: () => void;
  onRedo: () => void;
  onPlace: () => void;
  /** Frames every card. False when the board is empty. */
  onFitView: () => boolean;
  setView: (
    next: CanvasView | ((current: CanvasView) => CanvasView),
  ) => void;
  slideCount?: number;
  onStartPresent?: () => void;
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
  onFitView,
  setView,
  slideCount = 0,
  onStartPresent,
}: Props) {
  const filter = useCardFilterControls(blockId);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!filter.open) return;
    const onDown = (event: MouseEvent) => {
      const root = popoverRef.current;
      if (
        root == null ||
        (event.target instanceof Node && root.contains(event.target))
      ) {
        return;
      }
      filter.setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [filter.open, filter.setOpen]);

  return (
    <div className="owb-toolbar">
      <BoardTitle blockId={blockId} name={boardName(block)} />
      <button
        type="button"
        className="owb-toolbar-btn"
        title={t("Open as outline")}
        onClick={() => openBoardAsOutline(blockId)}
      >
        <i className="ti ti-list" />
      </button>
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
      <div className="owb-toolbar-filter" ref={popoverRef}>
        <button
          type="button"
          className={`owb-toolbar-btn${filter.active || filter.open ? " is-active" : ""}`}
          title={t("Filter cards")}
          aria-pressed={filter.active}
          onClick={() => filter.setOpen(!filter.open)}
        >
          <i className="ti ti-filter" />
        </button>
        {filter.open ? <CardFilterPopover controls={filter} /> : null}
      </div>
      <div className="owb-toolbar-sep" />
      <button
        type="button"
        className="owb-toolbar-btn"
        title={t("Slideshow outline")}
        onClick={invokeSlideOutlineOnActivePanel}
      >
        <i className="ti ti-list-numbers" />
      </button>
      <button
        type="button"
        className="owb-toolbar-btn"
        disabled={slideCount === 0}
        title={
          slideCount === 0
            ? t("Add sections to the slideshow first")
            : t("Start slideshow")
        }
        onClick={onStartPresent}
      >
        <i className="ti ti-presentation" />
      </button>
      <div className="owb-toolbar-sep" />
      <div className="owb-zoom">
        <button
          type="button"
          className="owb-zoom-btn"
          onClick={() =>
            setView((current: CanvasView) => ({
              ...current,
              scale: nextZoomScale(current.scale, -1),
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
          title={t("Zoom to fit")}
          onClick={() => {
            // Empty board: nothing to frame, so fall back to the home view.
            if (!onFitView()) setView(DEFAULT_VIEW);
          }}
        />
        <div className="owb-zoom-sep" />
        <button
          type="button"
          className="owb-zoom-btn"
          onClick={() =>
            setView((current: CanvasView) => ({
              ...current,
              scale: nextZoomScale(current.scale, 1),
            }))
          }
        >
          +
        </button>
      </div>
    </div>
  );
}
