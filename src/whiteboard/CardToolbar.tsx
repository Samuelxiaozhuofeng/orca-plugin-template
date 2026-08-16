import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import { openBoard, PANEL_TYPE, type WhiteboardCard } from "./data";
import { isWhiteboardBlock } from "./pageBoardPlan";

const { useEffect, useRef } = window.React;

export function openCardInSidePanel(blockId: DbId): void {
  try {
    if (isWhiteboardBlock(orca.state.blocks[blockId])) {
      orca.nav.openInLastPanel(PANEL_TYPE, { blockId });
      return;
    }
    orca.nav.openInLastPanel("block", { blockId });
  } catch (err) {
    console.error("Failed to open block in side panel", err);
  }
}

export function openCardInThisPanel(blockId: DbId, panelId: string): void {
  try {
    if (isWhiteboardBlock(orca.state.blocks[blockId])) {
      openBoard(blockId, panelId, false);
      return;
    }
    orca.nav.goTo("block", { blockId }, panelId);
  } catch (err) {
    console.error("Failed to open block in this panel", err);
  }
}

export const COLOR_PRESETS = [
  { id: "default", label: "Default", bg: "var(--orca-color-bg-1)" },
  { id: "blue", label: "Blue", bg: "rgba(47, 128, 237, 0.18)" },
  { id: "green", label: "Green", bg: "rgba(34, 197, 94, 0.18)" },
  { id: "yellow", label: "Yellow", bg: "rgba(234, 179, 8, 0.22)" },
  { id: "coral", label: "Coral", bg: "rgba(244, 63, 94, 0.18)" },
  { id: "purple", label: "Purple", bg: "rgba(168, 85, 247, 0.18)" },
];

const CONNECT_DRAG_PX = 4;

export function CardToolbar({
  card,
  fitContentHeight,
  onPatchCard,
  onStartConnect,
}: {
  card: WhiteboardCard;
  fitContentHeight: () => void;
  onPatchCard: (
    blockId: DbId,
    patch: { x?: number; y?: number; w?: number; h?: number; color?: string },
  ) => void;
  onStartConnect: (
    card: WhiteboardCard,
    event: React.MouseEvent,
    mode: "drag" | "click",
  ) => void;
}) {
  const [colorMenuOpen, setColorMenuOpen] = window.React.useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const connectBtnRef = useRef<HTMLButtonElement | null>(null);
  const connectTrackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!colorMenuOpen) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && popoverRef.current?.contains(target)) return;
      setColorMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setColorMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [colorMenuOpen]);

  useEffect(() => {
    return () => {
      connectTrackRef.current?.();
      connectTrackRef.current = null;
    };
  }, []);

  const onConnectMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    connectTrackRef.current?.();
    const originX = event.clientX;
    const originY = event.clientY;
    let fired = false;
    const startEvent = event;

    const fire = (mode: "drag" | "click") => {
      if (fired) return;
      fired = true;
      detach();
      onStartConnect(card, startEvent, mode);
      // After startDraw: a previous session's cleanup would strip this class.
      if (mode === "click") {
        connectBtnRef.current?.classList.add("is-connecting");
      }
    };

    const onMove = (move: MouseEvent) => {
      if (Math.hypot(move.clientX - originX, move.clientY - originY) <= CONNECT_DRAG_PX) {
        return;
      }
      fire("drag");
    };
    const onUp = () => fire("click");
    const detach = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (connectTrackRef.current === detach) connectTrackRef.current = null;
    };

    connectTrackRef.current = detach;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      className="owb-card-floating-toolbar"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="owb-card-tb-btn"
        title={t("Open in side panel")}
        onClick={() => openCardInSidePanel(card.blockId)}
      >
        <i className="ti ti-layout-sidebar-right" />
      </button>
      <button
        type="button"
        className="owb-card-tb-btn"
        title={t("Fit content height")}
        onClick={fitContentHeight}
      >
        <i className="ti ti-arrows-vertical" />
      </button>
      <button
        type="button"
        ref={connectBtnRef}
        className="owb-card-tb-btn"
        title={t("Connect to another card")}
        onMouseDown={onConnectMouseDown}
      >
        <i className="ti ti-arrow-up-right" />
      </button>
      <div className="owb-card-tb-popover-wrapper" ref={popoverRef}>
        <button
          type="button"
          className="owb-card-tb-btn"
          title={t("Card color")}
          onClick={() => setColorMenuOpen((v: boolean) => !v)}
        >
          <i className="ti ti-palette" />
        </button>
        {colorMenuOpen ? (
          <div className="owb-card-color-popover">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`owb-card-color-dot${
                  (card.color || "default") === preset.id ? " is-active" : ""
                }`}
                style={{ backgroundColor: preset.bg }}
                title={t(preset.label)}
                onClick={() => {
                  setColorMenuOpen(false);
                  onPatchCard(card.blockId, {
                    color: preset.id === "default" ? undefined : preset.id,
                  });
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
