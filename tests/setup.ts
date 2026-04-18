import { vi } from "vitest";

// Stub `server-only` so server modules can be imported in Vitest
vi.mock("server-only", () => ({}));

// Only load DOM polyfills when running in browser environment
if (typeof window !== "undefined") {
  // Polyfill ResizeObserver (required by Radix UI)
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // Polyfill Element.scrollIntoView
  if (typeof Element.prototype.scrollIntoView === "undefined") {
    Element.prototype.scrollIntoView = function () {};
  }
}
