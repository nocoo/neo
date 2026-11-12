import { describe, expect, it } from "vitest";
import {
  formatDeclarationErrors,
  parseSlotStatus,
  SLOT_IDS,
  validateSlotDeclarations,
  validateSlotVersions,
} from "../../../scripts/quality/z1";

const validDeclaration = SLOT_IDS.map((id) => ({
  id,
  status: id === "L2" || id === "P1" ? "na" : "impl",
  ...(id === "L2" || id === "P1" ? { reason: "not applicable in this repository" } : {}),
}));

describe("validateSlotDeclarations", () => {
  it("accepts a declaration that covers every slot", () => {
    const result = validateSlotDeclarations(validDeclaration);
    expect(result.errors).toEqual([]);
    expect(result.declarations).toHaveLength(SLOT_IDS.length);
  });

  it("rejects a declaration that is not an array", () => {
    const result = validateSlotDeclarations({ S1: { status: "impl" } });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain("must be an array");
  });

  it("rejects an entry that is not an object", () => {
    const result = validateSlotDeclarations(["S1"]);
    expect(result.errors[0]?.message).toContain("must be an object");
  });

  it("rejects an unknown slot id", () => {
    const result = validateSlotDeclarations([{ id: "L9", status: "impl" }]);
    expect(result.errors.some((error) => error.message.includes("unknown slot id"))).toBe(true);
  });

  it("rejects a duplicated slot id", () => {
    const result = validateSlotDeclarations([
      { id: "S1", status: "impl" },
      { id: "S1", status: "impl" },
    ]);
    expect(result.errors.some((error) => error.message.includes("duplicate slot id"))).toBe(true);
  });

  it("rejects a missing slot", () => {
    const result = validateSlotDeclarations([{ id: "S1", status: "impl" }]);
    const missing = result.errors.filter((error) => error.message.includes("is missing"));
    expect(missing).toHaveLength(SLOT_IDS.length - 1);
  });

  it("rejects an unknown status", () => {
    const result = validateSlotDeclarations([{ id: "S1", status: "maybe" }]);
    expect(result.errors.some((error) => error.message.includes("status must be one of"))).toBe(
      true,
    );
  });

  it("rejects a na slot without a reason", () => {
    const result = validateSlotDeclarations([{ id: "S1", status: "na" }]);
    expect(result.errors.some((error) => error.message.includes("needs a reason"))).toBe(true);
  });

  it("rejects a todo slot without a reason", () => {
    const result = validateSlotDeclarations([{ id: "S1", status: "todo" }]);
    expect(result.errors.some((error) => error.message.includes("needs a reason"))).toBe(true);
  });

  it("rejects an empty reason", () => {
    const result = validateSlotDeclarations([{ id: "S1", status: "na", reason: "  " }]);
    expect(result.errors.some((error) => error.message.includes("non-empty string"))).toBe(true);
  });

  it("rejects a reason on an implemented slot", () => {
    const result = validateSlotDeclarations([{ id: "S1", status: "impl", reason: "because" }]);
    expect(result.errors.some((error) => error.message.includes("must not declare a reason"))).toBe(
      true,
    );
  });

  it("rejects an unknown field", () => {
    const result = validateSlotDeclarations([{ id: "S1", status: "impl", sha: "abc" }]);
    expect(result.errors.some((error) => error.message.includes('unknown field "sha"'))).toBe(true);
  });
});

describe("parseSlotStatus", () => {
  it("parses a valid declaration", () => {
    const result = parseSlotStatus(JSON.stringify(validDeclaration));
    expect(result.errors).toEqual([]);
    expect(result.declarations).toHaveLength(SLOT_IDS.length);
  });

  it("reports invalid JSON", () => {
    const result = parseSlotStatus("{ not json");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain("not valid JSON");
  });

  it("formats the errors with their path", () => {
    const result = parseSlotStatus('[{"id":"S1","status":"maybe"}]');
    const formatted = formatDeclarationErrors(result.errors);
    expect(formatted).toContain("$[0].status");
    expect(formatted).toContain("is missing");
  });
});

describe("validateSlotVersions", () => {
  const sha = "a".repeat(40);

  it("accepts slots that tested the same version", () => {
    expect(
      validateSlotVersions([
        { id: "S1", sha },
        { id: "S2", sha },
      ]),
    ).toEqual([]);
  });

  it("rejects slots that tested different versions", () => {
    const errors = validateSlotVersions([
      { id: "S1", sha },
      { id: "S2", sha: "b".repeat(40) },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("while the other slots tested");
  });

  it("rejects a slot that did not report a version", () => {
    const errors = validateSlotVersions([{ id: "S1", sha: undefined }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("did not report the version");
  });

  it("rejects a malformed version", () => {
    const errors = validateSlotVersions([{ id: "S1", sha: "not-a-sha" }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("invalid version");
  });

  it("rejects a slot that reported twice", () => {
    const errors = validateSlotVersions([
      { id: "S1", sha },
      { id: "S1", sha },
    ]);
    expect(errors.some((error) => error.includes("reported its version twice"))).toBe(true);
  });
});
