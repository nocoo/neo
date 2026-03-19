import { describe, it, expect } from "vitest";

describe("test setup", () => {
  it("vitest is working", () => {
    expect(1 + 1).toBe(2);
  });

  it("jsdom environment is available", () => {
    expect(typeof document).toBe("object");
    expect(typeof window).toBe("object");
  });
});
