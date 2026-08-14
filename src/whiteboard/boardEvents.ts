type BoardCardsListener = (boardId: number) => void;

const listeners = new Set<BoardCardsListener>();

export function onBoardCardsChanged(fn: BoardCardsListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitBoardCardsChanged(boardId: number): void {
  try {
    for (const fn of listeners) {
      try {
        fn(boardId);
      } catch (err) {
        console.error("[whiteboard] onBoardCardsChanged listener failed", err);
      }
    }
  } catch (err) {
    console.error("[whiteboard] emitBoardCardsChanged failed", err);
  }
}
