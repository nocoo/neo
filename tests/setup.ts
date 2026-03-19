import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Stub `server-only` so server modules can be imported in Vitest (jsdom)
vi.mock("server-only", () => ({}));

// Polyfill ResizeObserver for jsdom (required by Radix UI)
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Polyfill Element.scrollIntoView for jsdom
if (typeof Element.prototype.scrollIntoView === "undefined") {
  Element.prototype.scrollIntoView = function () {};
}

// Polyfill pointer capture methods for jsdom (required by Radix Select)
if (typeof Element.prototype.hasPointerCapture === "undefined") {
  Element.prototype.hasPointerCapture = function () {
    return false;
  };
}
if (typeof Element.prototype.setPointerCapture === "undefined") {
  Element.prototype.setPointerCapture = function () {};
}
if (typeof Element.prototype.releasePointerCapture === "undefined") {
  Element.prototype.releasePointerCapture = function () {};
}
