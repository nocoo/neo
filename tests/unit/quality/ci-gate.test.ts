import { describe, expect, it } from "vitest";
import { EXTRA_JOBS, type Needs, SLOT_JOBS, verifyCiGate } from "../../../scripts/quality/ci-gate";
import { SLOT_IDS, type SlotDeclaration } from "../../../scripts/quality/z1";

const SHA = "a".repeat(40);

const declarations: SlotDeclaration[] = SLOT_IDS.map((id) =>
  id === "L2" || id === "P1"
    ? { id, status: "na", reason: "not applicable" }
    : { id, status: "impl" },
);

function healthyNeeds(): Needs {
  const needs: Needs = {};
  for (const id of SLOT_IDS) {
    if (id === "Z1") continue;
    const entry = declarations.find((item) => item.id === id);
    needs[SLOT_JOBS[id]] =
      entry?.status === "impl"
        ? { result: "success", outputs: { "tested-sha": SHA } }
        : { result: "skipped" };
  }
  for (const job of EXTRA_JOBS) {
    needs[job] = { result: "success", outputs: { "tested-sha": SHA } };
  }
  return needs;
}

function verify(needs: Needs = healthyNeeds()) {
  return verifyCiGate({ needs, declarations, expectedSha: SHA });
}

describe("verifyCiGate", () => {
  it("accepts every slot and blocking job on the checked-out sha", () => {
    const result = verify();
    expect(result.errors).toEqual([]);
    expect(result.verified).toHaveLength(11);
  });

  it("rejects an implemented slot that failed", () => {
    const needs = healthyNeeds();
    needs[SLOT_JOBS.S1] = { result: "failure", outputs: { "tested-sha": SHA } };
    expect(verify(needs).errors.some((error) => error.includes("s1-types"))).toBe(true);
  });

  it("rejects an implemented slot that was skipped", () => {
    const needs = healthyNeeds();
    needs[SLOT_JOBS.L1] = { result: "skipped" };
    expect(verify(needs).errors.some((error) => error.includes("finished skipped"))).toBe(true);
  });

  it("rejects an na slot that ran", () => {
    const needs = healthyNeeds();
    needs[SLOT_JOBS.L2] = { result: "success", outputs: { "tested-sha": SHA } };
    expect(verify(needs).errors.some((error) => error.includes("declared na"))).toBe(true);
  });

  it("rejects a missing slot result", () => {
    const needs = healthyNeeds();
    delete needs[SLOT_JOBS.G2];
    expect(verify(needs).errors.some((error) => error.includes("no result for slot G2"))).toBe(
      true,
    );
  });

  it("rejects a tested sha that differs from the checkout", () => {
    const needs = healthyNeeds();
    needs[SLOT_JOBS.B1] = { result: "success", outputs: { "tested-sha": "b".repeat(40) } };
    expect(verify(needs).errors.some((error) => error.includes("while CI checked out"))).toBe(true);
  });

  it("rejects a missing tested sha", () => {
    const needs = healthyNeeds();
    needs[SLOT_JOBS.S3] = { result: "success", outputs: {} };
    expect(verify(needs).errors.some((error) => error.includes("valid tested-sha"))).toBe(true);
  });

  it("rejects a malformed tested sha", () => {
    const needs = healthyNeeds();
    needs[SLOT_JOBS.L4] = { result: "success", outputs: { "tested-sha": "abc" } };
    expect(verify(needs).errors.some((error) => error.includes("valid tested-sha"))).toBe(true);
  });

  it("rejects a missing blocking job outside the slot list", () => {
    const needs = healthyNeeds();
    delete needs["container-smoke"];
    expect(verify(needs).errors.some((error) => error.includes("no result for blocking job"))).toBe(
      true,
    );
  });

  it("rejects an extra blocking job that failed", () => {
    const needs = healthyNeeds();
    needs["hook-self-test"] = { result: "failure", outputs: { "tested-sha": SHA } };
    expect(verify(needs).errors.some((error) => error.includes("hook-self-test"))).toBe(true);
  });

  it("rejects an unexpected blocking job", () => {
    const needs = healthyNeeds();
    needs["mystery-job"] = { result: "success", outputs: { "tested-sha": SHA } };
    expect(verify(needs).errors.some((error) => error.includes("unexpected blocking job"))).toBe(
      true,
    );
  });

  it("rejects a slot without a declaration", () => {
    const result = verifyCiGate({
      needs: healthyNeeds(),
      declarations: declarations.filter((entry) => entry.id !== "S2"),
      expectedSha: SHA,
    });
    expect(result.errors.some((error) => error.includes("slot S2 has no declaration"))).toBe(true);
  });

  it("rejects an invalid expected sha", () => {
    const result = verifyCiGate({ needs: healthyNeeds(), declarations, expectedSha: "main" });
    expect(result.errors[0]).toContain("expected commit sha is invalid");
  });

  it("rejects an empty needs object", () => {
    const result = verifyCiGate({ needs: {}, declarations, expectedSha: SHA });
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
