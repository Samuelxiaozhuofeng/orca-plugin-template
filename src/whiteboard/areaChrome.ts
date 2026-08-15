import type { DbId } from "../orca.d.ts";
import {
  areaColorIfValid,
  areaIsCollapsed,
  cardInArea,
  type WhiteboardArea,
} from "./areas.ts";

export function planAreaColor(
  areas: readonly WhiteboardArea[],
  id: string,
  color: string | undefined,
): WhiteboardArea[] | null {
  const target = areas.find((area) => area.id === id);
  if (target == null) return null;
  const nextColor = areaColorIfValid(color);
  if (target.color === nextColor) return null;
  return areas.map((area) => {
    if (area.id !== id) return area;
    if (nextColor == null) {
      const next = { ...area };
      delete next.color;
      return next;
    }
    return { ...area, color: nextColor };
  });
}

export function planAreaCollapsed(
  areas: readonly WhiteboardArea[],
  id: string,
  collapsed: boolean,
): WhiteboardArea[] | null {
  const target = areas.find((area) => area.id === id);
  if (target == null) return null;
  if (areaIsCollapsed(target) === collapsed) return null;
  return areas.map((area) => {
    if (area.id !== id) return area;
    if (!collapsed) {
      const next = { ...area };
      delete next.collapsed;
      return next;
    }
    return { ...area, collapsed: true as const };
  });
}

export function hiddenCardIdsInCollapsedAreas(
  areas: ReadonlyArray<WhiteboardArea>,
  cards: ReadonlyArray<{
    blockId: DbId;
    x: number;
    y: number;
    w: number;
    h: number;
  }>,
): Set<DbId> {
  const hidden = new Set<DbId>();
  const collapsed = areas.filter(areaIsCollapsed);
  if (collapsed.length === 0) return hidden;
  for (const card of cards) {
    for (const area of collapsed) {
      if (cardInArea(card, area)) {
        hidden.add(card.blockId);
        break;
      }
    }
  }
  return hidden;
}

export function hiddenEdgeIdsInCollapsedAreas(
  hiddenCards: ReadonlySet<DbId>,
  edges: ReadonlyArray<{ id: string; from: DbId; to: DbId }>,
): Set<string> {
  const hidden = new Set<string>();
  if (hiddenCards.size === 0) return hidden;
  for (const edge of edges) {
    if (hiddenCards.has(edge.from) && hiddenCards.has(edge.to)) {
      hidden.add(edge.id);
    }
  }
  return hidden;
}

export function collapsedAreaHideSets(
  areas: ReadonlyArray<WhiteboardArea>,
  cards: ReadonlyArray<{
    blockId: DbId;
    x: number;
    y: number;
    w: number;
    h: number;
  }>,
  edges: ReadonlyArray<{ id: string; from: DbId; to: DbId }>,
): { cardIds: Set<DbId>; edgeIds: Set<string> } {
  const cardIds = hiddenCardIdsInCollapsedAreas(areas, cards);
  return {
    cardIds,
    edgeIds: hiddenEdgeIdsInCollapsedAreas(cardIds, edges),
  };
}

/** Cards the user may marquee / ⌘A / nudge / delete. Hidden members stay in `cards`. */
export function operableCards<
  C extends {
    blockId: DbId;
    x: number;
    y: number;
    w: number;
    h: number;
  },
>(
  areas: ReadonlyArray<WhiteboardArea>,
  cards: readonly C[],
  extraHidden?: ReadonlySet<DbId> | null,
): C[] {
  const hidden = hiddenCardIdsInCollapsedAreas(areas, cards);
  if (extraHidden != null) {
    for (const id of extraHidden) hidden.add(id);
  }
  if (hidden.size === 0) return cards as C[];
  return cards.filter((card) => !hidden.has(card.blockId));
}

/**
 * Re-attach any cards `next` dropped, so an operable-only commit cannot
 * erase members sitting in a collapsed section.
 */
export function mergePreservingHidden<C extends { blockId: DbId }>(
  allCards: readonly C[],
  next: readonly C[],
): C[] {
  if (next.length >= allCards.length) return next as C[];
  const byId = new Map(next.map((card) => [card.blockId, card]));
  return allCards.map((card) => byId.get(card.blockId) ?? card);
}

/** One-call filter for the canvas: hide collapsed members and internal edges. */
export function visibleAfterCollapsedAreas<
  C extends {
    blockId: DbId;
    x: number;
    y: number;
    w: number;
    h: number;
  },
  E extends { id: string; from: DbId; to: DbId },
>(
  areas: ReadonlyArray<WhiteboardArea>,
  cards: readonly C[],
  shownCards: readonly C[],
  edges: readonly E[],
): { cards: C[]; shownCards: C[]; edges: E[] } {
  const hide = collapsedAreaHideSets(areas, cards, edges);
  if (hide.cardIds.size === 0) {
    return {
      cards: cards as C[],
      shownCards: shownCards as C[],
      edges: edges as E[],
    };
  }
  return {
    cards: cards.filter((card) => !hide.cardIds.has(card.blockId)),
    shownCards: shownCards.filter((card) => !hide.cardIds.has(card.blockId)),
    edges: edges.filter((edge) => !hide.edgeIds.has(edge.id)),
  };
}
