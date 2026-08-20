import type { DbId } from "../orca.d.ts";
import type { WhiteboardArea } from "./areas.ts";
import type { CanvasOrigin, WhiteboardCard } from "./data.ts";
import type { CanvasFocusApi } from "./cardFocus.ts";
import type { WhiteboardEdge } from "./edges.ts";
import type { CardPatchEntry, PatchCardsFn } from "./useCanvasPointer.ts";
import type { CanvasView } from "./viewTransform.ts";
import type { PresentationState } from "./usePresentation.ts";

export type CanvasProps = {
  panelId: string;
  boardBlockId: DbId;
  cards: WhiteboardCard[];
  view: CanvasView;
  zoomLabelRef: { current: HTMLElement | null };
  onViewChange: (view: CanvasView) => void;
  onPatchCards: PatchCardsFn;
  onRemoveCards: (
    ids: DbId[],
    opts?: { permanent?: boolean },
  ) => Promise<boolean>;
  onAddCards: (cards: WhiteboardCard[]) => Promise<boolean>;
  onCommitEdges: (
    next: WhiteboardEdge[],
    cardIds?: ReadonlySet<DbId>,
  ) => Promise<boolean>;
  onCommitAreas: (next: WhiteboardArea[]) => Promise<boolean>;
  onCommitCardsAndAreas: (
    cards: WhiteboardCard[],
    areas: WhiteboardArea[],
  ) => Promise<boolean>;
  drawArea: boolean;
  onExitDrawArea: () => void;
  onStartDrawArea: () => void;
  onUndo: () => void;
  onRedo: () => void;
  edges: WhiteboardEdge[];
  areas: WhiteboardArea[];
  onViewportWidth: (width: number) => void;
  onPlaceJournalsAt: (origin: CanvasOrigin) => void;
  focusApiRef: { current: CanvasFocusApi | null };
  presenting?: boolean;
  presentation?: PresentationState;
  presentReveal?: { revealedIds: ReadonlySet<DbId>; currentId: DbId | null } | null;
};
