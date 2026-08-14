import {
  applyViewToDom,
  clientToWorld,
  finalizeView,
  isPinchZoomEvent,
  normalizeWheelDeltaY,
  scaleFromWheelDelta,
  WHEEL_COMMIT_MS,
  type CanvasView,
} from "./viewTransform";
import { isEditableTarget } from "./canvasKeys";

const { useCallback, useEffect, useLayoutEffect, useRef, useState } =
  window.React;

type Runtime = {
  gesture: "pan" | "wheel" | null;
  raf: number;
  wheelTimer: number;
};

type Opts = {
  panelId: string;
  view: CanvasView;
  zoomLabelRef: { current: HTMLElement | null };
  onViewChange: (view: CanvasView) => void;
  onViewportWidth: (width: number) => void;
  isEditing: () => boolean;
};

export function useCanvasView({
  panelId,
  view,
  zoomLabelRef,
  onViewChange,
  onViewportWidth,
  isEditing,
}: Opts) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const liveViewRef = useRef(view);
  const committedRef = useRef(view);
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  const isEditingRef = useRef(isEditing);
  isEditingRef.current = isEditing;
  const spaceHeldRef = useRef(false);
  const [viewportSize, setViewportSize] = useState({
    width: 800,
    height: 600,
  });
  const runtimeRef = useRef<Runtime>({
    gesture: null,
    raf: 0,
    wheelTimer: 0,
  });

  const paint = useCallback(() => {
    applyViewToDom(
      canvasRef.current,
      gridRef.current,
      zoomLabelRef.current,
      liveViewRef.current,
    );
  }, [zoomLabelRef]);

  const schedulePaint = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime.raf !== 0) return;
    runtime.raf = window.requestAnimationFrame(() => {
      runtime.raf = 0;
      paint();
    });
  }, [paint]);

  const commitView = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime.raf !== 0) {
      window.cancelAnimationFrame(runtime.raf);
      runtime.raf = 0;
    }
    if (runtime.wheelTimer !== 0) {
      window.clearTimeout(runtime.wheelTimer);
      runtime.wheelTimer = 0;
    }
    const next = finalizeView(liveViewRef.current, {
      width: viewportRef.current?.clientWidth ?? viewportSize.width,
      height: viewportRef.current?.clientHeight ?? viewportSize.height,
    });
    const prev = committedRef.current;
    liveViewRef.current = next;
    committedRef.current = next;
    runtime.gesture = null;
    viewportRef.current?.classList.remove("is-panning");
    paint();
    if (prev.x !== next.x || prev.y !== next.y || prev.scale !== next.scale) {
      onViewChangeRef.current(next);
    }
  }, [paint, viewportSize.height, viewportSize.width]);

  const scheduleWheelCommit = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime.wheelTimer !== 0) window.clearTimeout(runtime.wheelTimer);
    runtime.wheelTimer = window.setTimeout(() => {
      runtime.wheelTimer = 0;
      commitView();
    }, WHEEL_COMMIT_MS);
  }, [commitView]);

  useLayoutEffect(() => {
    const parentChanged =
      view.x !== committedRef.current.x ||
      view.y !== committedRef.current.y ||
      view.scale !== committedRef.current.scale;
    if (runtimeRef.current.gesture != null && !parentChanged) return;
    if (parentChanged && runtimeRef.current.gesture != null) {
      runtimeRef.current.gesture = null;
      if (runtimeRef.current.wheelTimer !== 0) {
        window.clearTimeout(runtimeRef.current.wheelTimer);
        runtimeRef.current.wheelTimer = 0;
      }
    }
    liveViewRef.current = view;
    committedRef.current = view;
    paint();
  }, [paint, view]);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const report = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      onViewportWidth(width);
      setViewportSize((prev: { width: number; height: number }) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onViewportWidth]);

  const wheelRef = useRef<(event: WheelEvent) => void>(() => {});

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (event: WheelEvent) => wheelRef.current(event);
    const blockMiddle = (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault();
    };
    el.addEventListener("wheel", handler, { passive: false });
    el.addEventListener("mousedown", blockMiddle);
    el.addEventListener("auxclick", blockMiddle);
    return () => {
      el.removeEventListener("wheel", handler);
      el.removeEventListener("mousedown", blockMiddle);
      el.removeEventListener("auxclick", blockMiddle);
    };
  }, []);

  useEffect(() => {
    return () => {
      const runtime = runtimeRef.current;
      if (runtime.raf !== 0) window.cancelAnimationFrame(runtime.raf);
      if (runtime.wheelTimer !== 0) window.clearTimeout(runtime.wheelTimer);
    };
  }, []);

  const pointerToWorld = useCallback((clientX: number, clientY: number) => {
    return clientToWorld(
      viewportRef.current,
      liveViewRef.current,
      clientX,
      clientY,
    );
  }, []);

  const startPan = useCallback(
    (startX: number, startY: number) => {
      const runtime = runtimeRef.current;
      if (runtime.gesture === "pan") return;
      if (runtime.wheelTimer !== 0) {
        window.clearTimeout(runtime.wheelTimer);
        runtime.wheelTimer = 0;
      }
      runtime.gesture = "pan";
      viewportRef.current?.classList.add("is-panning");
      const origin = liveViewRef.current;

      const onMove = (moveEvent: MouseEvent) => {
        liveViewRef.current = {
          ...origin,
          x: origin.x + moveEvent.clientX - startX,
          y: origin.y + moveEvent.clientY - startY,
        };
        schedulePaint();
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        commitView();
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [commitView, schedulePaint],
  );

  useEffect(() => {
    const setSpace = (held: boolean) => {
      spaceHeldRef.current = held;
      viewportRef.current?.classList.toggle("is-space-pan", held);
    };

    const canUseSpace = (event: KeyboardEvent) => {
      if (isEditingRef.current()) return false;
      if (orca.state.activePanel !== panelId) return false;
      if (isEditableTarget(event.target)) return false;
      const panel = viewportRef.current?.closest(".owb-panel");
      const active = document.activeElement;
      if (
        panel != null &&
        active instanceof Node &&
        active !== document.body &&
        !panel.contains(active)
      ) {
        return false;
      }
      return true;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") return;
      if (!canUseSpace(event)) return;
      event.preventDefault();
      if (event.repeat) return;
      setSpace(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") return;
      setSpace(false);
    };
    const onBlur = () => setSpace(false);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      setSpace(false);
    };
  }, [panelId]);

  const onWheel = (event: WheelEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".owb-card-body")) return;

    const el = viewportRef.current;
    if (!el) return;

    event.preventDefault();
    const runtime = runtimeRef.current;
    runtime.gesture = "wheel";
    const current = liveViewRef.current;

    if (event.ctrlKey || event.metaKey) {
      const rect = el.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const worldX = (mouseX - current.x) / current.scale;
      const worldY = (mouseY - current.y) / current.scale;
      const scale = scaleFromWheelDelta(
        current.scale,
        normalizeWheelDeltaY(event),
        isPinchZoomEvent(event),
      );
      liveViewRef.current = {
        scale,
        x: mouseX - worldX * scale,
        y: mouseY - worldY * scale,
      };
      schedulePaint();
      scheduleWheelCommit();
      return;
    }

    if (event.shiftKey) {
      liveViewRef.current = {
        ...current,
        x: current.x - (event.deltaY || event.deltaX),
      };
    } else {
      liveViewRef.current = {
        ...current,
        x: current.x - event.deltaX,
        y: current.y - event.deltaY,
      };
    }
    schedulePaint();
    scheduleWheelCommit();
  };

  wheelRef.current = onWheel;

  return {
    viewportRef,
    canvasRef,
    gridRef,
    liveViewRef,
    viewportSize,
    spaceHeldRef,
    pointerToWorld,
    startPan,
  };
}
