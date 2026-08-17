import type { DbId } from "../orca.d.ts";

function isHtmlElement(el: unknown): el is HTMLElement {
  if (el == null) return false;
  if (typeof HTMLElement !== "undefined") {
    return el instanceof HTMLElement;
  }
  return typeof el === "object";
}

export class CardRowObserverManager {
  private resizeObserver: ResizeObserver | null = null;
  private mutationObservers = new Map<DbId, MutationObserver>();
  private scrollListeners = new Map<
    DbId,
    { el: HTMLElement; listener: EventListener }
  >();
  private observedCardIds = new Set<DbId>();
  private onCardChange: (cardId: DbId) => void;

  constructor(onCardChange: (cardId: DbId) => void) {
    this.onCardChange = onCardChange;
  }

  sync(canvas: HTMLElement | null, targetCardIds: ReadonlySet<DbId>): void {
    if (canvas == null || targetCardIds.size === 0) {
      this.disconnect();
      return;
    }

    // Unobserve cards no longer in targetCardIds
    for (const id of [...this.observedCardIds]) {
      if (!targetCardIds.has(id)) {
        this.unobserveCard(id);
      }
    }

    // Ensure ResizeObserver exists if browser supports it
    if (this.resizeObserver == null && typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          const blockIdStr = target.getAttribute("data-block-id");
          if (blockIdStr != null) {
            const cardId = Number(blockIdStr);
            if (Number.isFinite(cardId) && this.observedCardIds.has(cardId)) {
              this.onCardChange(cardId);
            }
          }
        }
      });
    }

    // Observe active cards
    for (const id of targetCardIds) {
      const cardEl = canvas.querySelector(`.owb-card[data-block-id="${id}"]`);
      if (isHtmlElement(cardEl)) {
        const existingScroll = this.scrollListeners.get(id);
        if (existingScroll && existingScroll.el !== cardEl) {
          this.unobserveCard(id);
        }
        if (!this.observedCardIds.has(id)) {
          this.observeCard(id, cardEl);
        }
      } else if (this.observedCardIds.has(id)) {
        this.unobserveCard(id);
      }
    }
  }

  private observeCard(cardId: DbId, cardEl: HTMLElement): void {
    this.observedCardIds.add(cardId);

    // 1. ResizeObserver for card size & layout shifts
    if (this.resizeObserver != null) {
      this.resizeObserver.observe(cardEl);
    }

    // 2. MutationObserver for row DOM appearing / disappearing
    if (typeof MutationObserver !== "undefined") {
      const mo = new MutationObserver(() => {
        this.onCardChange(cardId);
      });
      mo.observe(cardEl, { childList: true, subtree: true });
      this.mutationObservers.set(cardId, mo);
    }

    // 3. Scroll listener with capture to catch inner container scroll
    const onScroll: EventListener = () => {
      this.onCardChange(cardId);
    };
    cardEl.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    this.scrollListeners.set(cardId, { el: cardEl, listener: onScroll });
  }

  private unobserveCard(cardId: DbId): void {
    this.observedCardIds.delete(cardId);

    const scroll = this.scrollListeners.get(cardId);
    if (scroll != null) {
      scroll.el.removeEventListener("scroll", scroll.listener, {
        capture: true,
      });
      this.scrollListeners.delete(cardId);
      if (this.resizeObserver != null) {
        this.resizeObserver.unobserve(scroll.el);
      }
    }

    const mo = this.mutationObservers.get(cardId);
    if (mo != null) {
      mo.disconnect();
      this.mutationObservers.delete(cardId);
    }
  }

  disconnect(): void {
    for (const id of [...this.observedCardIds]) {
      this.unobserveCard(id);
    }
    if (this.resizeObserver != null) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }
}
