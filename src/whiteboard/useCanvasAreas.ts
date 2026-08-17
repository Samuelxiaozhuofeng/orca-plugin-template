import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  mergePreservingHidden,
  planAreaCollapsed,
  planAreaColor,
} from "./areaChrome";
import {
  planAddToSlides,
  planMoveSlide,
  planRemoveFromSlides,
  planReorderSlides,
} from "./areaSlides";
import {
  nextAreaId,
  planAreaMove,
  planWrapAreaFromCards,
  removeAreas,
  toggleAreaId,
  type WhiteboardArea,
} from "./areas";
import {
  discardLastRecord,
  runAsHistoryStep,
} from "./boardHistory";
import type { WhiteboardCard } from "./data";
import type { WhiteboardEdge } from "./edges";

const { useCallback, useEffect, useState } = window.React;

const wrapByPanel = new Map<string, () => void>();

type AreaChrome = {
  setColor: (id: string, color: string | undefined) => void;
  toggleCollapsed: (id: string) => void;
  addToSlides: (id: string) => void;
  moveSlide: (id: string, delta: number) => void;
  removeFromSlides: (id: string) => void;
  reorderSlides: (fromIndex: number, toIndex: number) => void;
  selectArea?: (id: string | null) => void;
};

const chromeByPanel = new Map<string, AreaChrome>();
const fullCardsByPanel = new Map<string, WhiteboardCard[]>();
const areasByPanel = new Map<string, WhiteboardArea[]>();

export function areaChromeFor(panelId: string): AreaChrome | undefined {
  return chromeByPanel.get(panelId);
}

export function areasForPanel(panelId: string): WhiteboardArea[] {
  return areasByPanel.get(panelId) ?? [];
}

/** Full board cards, including members of collapsed sections. */
export function bindPanelCards(
  panelId: string,
  cards: WhiteboardCard[],
): void {
  fullCardsByPanel.set(panelId, cards);
}

function cardsOnBoard(
  panelId: string,
  fallback: WhiteboardCard[],
): WhiteboardCard[] {
  return fullCardsByPanel.get(panelId) ?? fallback;
}

export function registerWrapAreaAction(
  panelId: string,
  wrap: () => void,
): () => void {
  wrapByPanel.set(panelId, wrap);
  return () => {
    if (wrapByPanel.get(panelId) === wrap) wrapByPanel.delete(panelId);
  };
}

export function invokeWrapSelectedOnActivePanel(): void {
  const panelId = orca.state.activePanel;
  if (panelId === "") return;
  wrapByPanel.get(panelId)?.();
}

type Args = {
  panelId: string;
  boardBlockId: DbId;
  areas: WhiteboardArea[];
  selectedAreasRef: { current: string[] };
  selectedRef: { current: DbId[] };
  cardsRef: { current: WhiteboardCard[] };
  edgesRef: { current: WhiteboardEdge[] };
  areasRef: { current: WhiteboardArea[] };
  onClearOtherSelection: () => void;
  onCommitAreas: (next: WhiteboardArea[]) => Promise<boolean>;
  onCommitCardsAndAreas: (
    cards: WhiteboardCard[],
    areas: WhiteboardArea[],
  ) => Promise<boolean>;
};

/** Selected areas plus wrap / rename / resize / delete / drag-follow. */
export function useCanvasAreas({
  panelId,
  boardBlockId,
  areas,
  selectedAreasRef,
  selectedRef,
  cardsRef,
  edgesRef,
  areasRef,
  onClearOtherSelection,
  onCommitAreas,
  onCommitCardsAndAreas,
}: Args) {
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  selectedAreasRef.current = selectedAreas;

  const selectArea = useCallback(
    (id: string | null, opts?: { toggle?: boolean }) => {
      if (id == null) {
        setSelectedAreas([]);
        return;
      }
      if (opts?.toggle) {
        setSelectedAreas((prev: string[]) => toggleAreaId(prev, id));
      } else {
        setSelectedAreas([id]);
        onClearOtherSelection();
      }
    },
    [onClearOtherSelection],
  );

  const selectAreas = useCallback((ids: readonly string[]) => {
    setSelectedAreas([...ids]);
  }, []);

  const snapshotNow = useCallback(() => {
    return {
      cards: cardsOnBoard(panelId, cardsRef.current).map(
        (card: WhiteboardCard) => ({ ...card }),
      ),
      edges: edgesRef.current.map((edge: WhiteboardEdge) => ({ ...edge })),
      areas: areasRef.current.map((area: WhiteboardArea) => ({ ...area })),
    };
  }, [panelId]);

  const commitAreasStep = useCallback(
    async (next: WhiteboardArea[]): Promise<boolean> => {
      const ok = await runAsHistoryStep(boardBlockId, snapshotNow(), () =>
        onCommitAreas(next),
      );
      if (!ok) discardLastRecord(boardBlockId);
      return ok;
    },
    [boardBlockId, onCommitAreas, snapshotNow],
  );

  useEffect(() => {
    if (selectedAreas.length === 0) return;
    const valid = new Set(areas.map((area: WhiteboardArea) => area.id));
    setSelectedAreas((prev: string[]) => {
      const next = prev.filter((id: string) => valid.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [areas, selectedAreas.length]);

  const wrapSelected = useCallback(() => {
    const ids = new Set<DbId>(selectedRef.current);
    const picked = cardsRef.current.filter((card: WhiteboardCard) =>
      ids.has(card.blockId),
    );
    const box = planWrapAreaFromCards(picked);
    if (box == null) return;
    const current = areasRef.current;
    const area: WhiteboardArea = {
      id: nextAreaId(current),
      name: t("Section"),
      ...box,
    };
    void commitAreasStep([...current, area]).then((ok: boolean) => {
      if (ok) selectArea(area.id);
    });
  }, [commitAreasStep, selectArea]);

  useEffect(() => registerWrapAreaAction(panelId, wrapSelected), [
    panelId,
    wrapSelected,
  ]);

  const createAreaAt = useCallback(
    (box: { x: number; y: number; w: number; h: number }) => {
      const current = areasRef.current;
      const area: WhiteboardArea = {
        id: nextAreaId(current),
        name: t("Section"),
        ...box,
      };
      void commitAreasStep([...current, area]).then((ok: boolean) => {
        if (ok) selectArea(area.id);
      });
    },
    [commitAreasStep, selectArea],
  );

  const renameArea = useCallback(
    (id: string, raw: string) => {
      const name = raw.trim() || t("Section");
      const current = areasRef.current;
      const target = current.find((area: WhiteboardArea) => area.id === id);
      if (target == null || target.name === name) return;
      void commitAreasStep(
        current.map((area: WhiteboardArea) =>
          area.id === id ? { ...area, name } : area,
        ),
      );
    },
    [commitAreasStep],
  );

  const resizeArea = useCallback(
    (id: string, box: { x: number; y: number; w: number; h: number }) => {
      const current = areasRef.current;
      const target = current.find((area: WhiteboardArea) => area.id === id);
      if (target == null) return;
      if (
        target.x === box.x &&
        target.y === box.y &&
        target.w === box.w &&
        target.h === box.h
      ) {
        return;
      }
      void commitAreasStep(
        current.map((area: WhiteboardArea) =>
          area.id === id ? { ...area, ...box } : area,
        ),
      );
    },
    [commitAreasStep],
  );

  const moveAreaBy = useCallback(
    (id: string, dx: number, dy: number) => {
      if (dx === 0 && dy === 0) return;
      const current = areasRef.current;
      const target = current.find((area: WhiteboardArea) => area.id === id);
      if (target == null) return;
      const allCards = cardsOnBoard(panelId, cardsRef.current);
      const planned = planAreaMove(target, dx, dy, allCards, current);
      void runAsHistoryStep(boardBlockId, snapshotNow(), () =>
        onCommitCardsAndAreas(
          mergePreservingHidden(allCards, planned.cards),
          planned.areas,
        ),
      ).then((ok: boolean) => {
        if (!ok) discardLastRecord(boardBlockId);
      });
    },
    [boardBlockId, onCommitCardsAndAreas, panelId, snapshotNow],
  );

  const deleteSelectedAreas = useCallback(() => {
    const ids = selectedAreasRef.current;
    if (ids.length === 0) return false;
    void commitAreasStep(removeAreas(areasRef.current, ids)).then(
      (ok: boolean) => {
        if (ok) setSelectedAreas([]);
      },
    );
    return true;
  }, [commitAreasStep]);

  const setAreaColor = useCallback(
    (id: string, color: string | undefined) => {
      const next = planAreaColor(areasRef.current, id, color);
      if (next == null) return;
      void commitAreasStep(next);
    },
    [commitAreasStep],
  );

  const toggleAreaCollapsed = useCallback(
    (id: string) => {
      const current = areasRef.current;
      const target = current.find((area: WhiteboardArea) => area.id === id);
      if (target == null) return;
      const next = planAreaCollapsed(current, id, target.collapsed !== true);
      if (next == null) return;
      void commitAreasStep(next);
    },
    [commitAreasStep],
  );

  const addToSlides = useCallback(
    (id: string) => {
      const next = planAddToSlides(areasRef.current, id);
      if (next == null) return;
      void commitAreasStep(next);
    },
    [commitAreasStep],
  );

  const moveSlide = useCallback(
    (id: string, delta: number) => {
      const next = planMoveSlide(areasRef.current, id, delta);
      if (next == null) return;
      void commitAreasStep(next);
    },
    [commitAreasStep],
  );

  const removeFromSlides = useCallback(
    (id: string) => {
      const next = planRemoveFromSlides(areasRef.current, id);
      if (next == null) return;
      void commitAreasStep(next);
    },
    [commitAreasStep],
  );

  const reorderSlides = useCallback(
    (fromIndex: number, toIndex: number) => {
      const next = planReorderSlides(areasRef.current, fromIndex, toIndex);
      if (next == null) return;
      void commitAreasStep(next);
    },
    [commitAreasStep],
  );

  areasByPanel.set(panelId, areas);

  chromeByPanel.set(panelId, {
    setColor: setAreaColor,
    toggleCollapsed: toggleAreaCollapsed,
    addToSlides,
    moveSlide,
    removeFromSlides,
    reorderSlides,
    selectArea,
  });
  useEffect(() => {
    return () => {
      const current = chromeByPanel.get(panelId);
      if (current?.setColor === setAreaColor) chromeByPanel.delete(panelId);
      fullCardsByPanel.delete(panelId);
      areasByPanel.delete(panelId);
    };
  }, [
    panelId,
    setAreaColor,
    toggleAreaCollapsed,
    addToSlides,
    moveSlide,
    removeFromSlides,
    reorderSlides,
    selectArea,
  ]);

  return {
    selectedAreas,
    selectArea,
    selectAreas,
    wrapSelected,
    createAreaAt,
    renameArea,
    resizeArea,
    moveAreaBy,
    deleteSelectedAreas,
    setAreaColor,
    toggleAreaCollapsed,
    addToSlides,
    moveSlide,
    removeFromSlides,
    reorderSlides,
  };
}
