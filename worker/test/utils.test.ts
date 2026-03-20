/**
 * Shared utility tests.
 */

import { describe, it, expect } from "vitest";
import { generateId } from "../src/utils/id";

describe("generateId", () => {
  it("generates ID with prefix", () => {
    const id = generateId("bk");
    expect(id).toMatch(/^bk_[a-z0-9]+_[a-z0-9]+$/);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId("test")));
    expect(ids.size).toBe(100);
  });

  it("uses default prefix", () => {
    const id = generateId();
    expect(id).toMatch(/^id_/);
  });
});
