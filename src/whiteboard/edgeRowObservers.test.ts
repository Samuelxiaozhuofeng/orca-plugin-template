import { CardRowObserverManager } from "./edgeRowObservers.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

// Mock DOM elements and environment
class MockDOMElement {
  attrs = new Map<string, string>();
  listeners = new Map<string, Set<EventListener>>();

  constructor(blockId: string) {
    this.attrs.set("data-block-id", blockId);
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  addEventListener(type: string, listener: EventListener): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(type: string): void {
    const set = this.listeners.get(type);
    if (set) {
      for (const listener of set) {
        listener({ target: this } as unknown as Event);
      }
    }
  }
}

// Setup global ResizeObserver & MutationObserver mock for test
class MockResizeObserver {
  callback: (entries: Array<{ target: MockDOMElement }>) => void;
  observed = new Set<MockDOMElement>();

  constructor(cb: (entries: Array<{ target: MockDOMElement }>) => void) {
    this.callback = cb;
  }

  observe(el: MockDOMElement): void {
    this.observed.add(el);
  }

  unobserve(el: MockDOMElement): void {
    this.observed.delete(el);
  }

  disconnect(): void {
    this.observed.clear();
  }

  trigger(el: MockDOMElement): void {
    this.callback([{ target: el }]);
  }
}

class MockMutationObserver {
  callback: () => void;
  observed: MockDOMElement | null = null;

  constructor(cb: () => void) {
    this.callback = cb;
  }

  observe(el: MockDOMElement): void {
    this.observed = el;
  }

  disconnect(): void {
    this.observed = null;
  }

  trigger(): void {
    this.callback();
  }
}

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = MockResizeObserver;
(globalThis as unknown as { MutationObserver: unknown }).MutationObserver = MockMutationObserver;

const card1El = new MockDOMElement("1");
const card2El = new MockDOMElement("2");

const mockCanvas = {
  querySelector(sel: string) {
    if (sel === '.owb-card[data-block-id="1"]') return card1El;
    if (sel === '.owb-card[data-block-id="2"]') return card2El;
    return null;
  },
} as unknown as HTMLElement;

const changes: number[] = [];
const manager = new CardRowObserverManager((cardId) => {
  changes.push(cardId);
});

// 1. Sync with no cards
manager.sync(mockCanvas, new Set());
check(card1El.listeners.get("scroll")?.size === 0 || !card1El.listeners.get("scroll"), "no scroll listeners on empty set");

// 2. Sync with Card 1
manager.sync(mockCanvas, new Set([1]));
check(card1El.listeners.get("scroll")?.size === 1, "card 1 has scroll listener");

// Trigger scroll on card 1
card1El.dispatchEvent("scroll");
check(changes.length === 1 && changes[0] === 1, "scroll on card 1 triggers onCardChange");

// 3. Sync with Card 2 (Card 1 removed, Card 2 added)
manager.sync(mockCanvas, new Set([2]));
check(card1El.listeners.get("scroll")?.size === 0, "card 1 scroll listener removed");
check(card2El.listeners.get("scroll")?.size === 1, "card 2 scroll listener added");

card2El.dispatchEvent("scroll");
check(changes.length === 2 && changes[1] === 2, "scroll on card 2 triggers onCardChange");

// 4. Disconnect cleans up everything
manager.disconnect();
check(card2El.listeners.get("scroll")?.size === 0, "card 2 scroll listener cleaned up on disconnect");

console.log("edgeRowObservers.test.ts ok");
