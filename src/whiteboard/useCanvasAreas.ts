import type { DbId } from "../orca.d.ts";
import { t } from "../libs/l10n";
import {
  nextAreaId,
  planAreaMove,
  planWrapAreaFromCards,
  removeArea,
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
  selectedAreaRef: { current: string | null };
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

/** Selected area plus wrap / rename / resize / delete / drag-follow. */
export function useCanvasAreas({
  panelId,
  boardBlockId,
  areas,
  selectedAreaRef,
  selectedRef,
  cardsRef,
  edgesRef,
  areasRef,
  onClearOtherSelection,
  onCommitAreas,
  onCommitCardsAndAreas,
}: Args) {
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  selectedAreaRef.current = selectedArea;

  const selectArea = useCallback(
    (id: string | null) => {
      setSelectedArea(id);
      if (id != null) onClearOtherSelection();
    },
    [onClearOtherSelection],
  );

  const snapshotNow = useCallback(() => {
    return {
      cards: cardsRef.current.map((card: WhiteboardCard) => ({ ...card })),
      edges: edgesRef.current.map((edge: WhiteboardEdge) => ({ ...edge })),
      areas: areasRef.current.map((area: WhiteboardArea) => ({ ...area })),
    };
  }, []);

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
    if (selectedArea == null) return;
    if (!areas.some((area: WhiteboardArea) => area.id === selectedArea)) {
      setSelectedArea(null);
    }
  }, [areas, selectedArea]);

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
      const planned = planAreaMove(target, dx, dy, cardsRef.current, current);
      void runAsHistoryStep(boardBlockId, snapshotNow(), () =>
        onCommitCardsAndAreas(planned.cards, planned.areas),
      ).then((ok: boolean) => {
        if (!ok) discardLastRecord(boardBlockId);
      });
    },
    [boardBlockId, onCommitCardsAndAreas, snapshotNow],
  );

  const deleteSelectedArea = useCallback(() => {
    const areaId = selectedAreaRef.current;
    if (areaId == null) return false;
    void commitAreasStep(removeArea(areasRef.current, areaId)).then(
      (ok: boolean) => {
        if (ok) selectArea(null);
      },
    );
    return true;
  }, [commitAreasStep, selectArea]);

  return {
    selectedArea,
    selectArea,
    wrapSelected,
    createAreaAt,
    renameArea,
    resizeArea,
    moveAreaBy,
    deleteSelectedArea,
  };
}
