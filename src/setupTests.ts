import "@testing-library/jest-dom";

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

class MockWebSocket {
  public static readonly OPEN = 1;
  public static readonly CLOSED = 3;

  public onmessage: ((event: MessageEvent<string>) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public readyState = MockWebSocket.OPEN;

  public constructor(public readonly url: string) {}

  public close(): void {
    this.readyState = MockWebSocket.CLOSED;
  }
}

Object.defineProperty(globalThis, "WebSocket", {
  writable: true,
  value: MockWebSocket,
});

Object.defineProperty(globalThis, "crypto", {
  value: {
    randomUUID: (): string => "test-session-id",
  },
  configurable: true,
});

Object.defineProperty(globalThis, "scrollTo", {
  value: jest.fn<void, []>(),
  writable: true,
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  value: jest.fn<void, [ScrollIntoViewOptions | boolean | undefined]>(),
  writable: true,
});