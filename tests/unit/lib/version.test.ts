import { describe, it, expect } from "vitest";
import { VERSION } from "@/lib/version";

describe("version", () => {
  it("exports a version string", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("matches package.json version", () => {
    expect(VERSION).toBe("0.1.0");
  });
});
