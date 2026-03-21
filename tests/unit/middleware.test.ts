/**
 * Middleware tests — auth guard for /dashboard routes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockAuth } = vi.hoisted(() => {
  return { mockAuth: vi.fn() };
});

vi.mock("@/auth", () => ({ auth: mockAuth }));

import { middleware, config } from "@/middleware";
import { NextRequest } from "next/server";

function createRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes through root path without auth check", async () => {
    const res = await middleware(createRequest("/"));
    expect(mockAuth).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("passes through non-dashboard paths without auth check", async () => {
    const res = await middleware(createRequest("/about"));
    expect(mockAuth).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("redirects to login when accessing /dashboard without session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await middleware(createRequest("/dashboard"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/?callbackUrl=%2Fdashboard");
  });

  it("redirects to login when session has no user", async () => {
    mockAuth.mockResolvedValue({ user: null });
    const res = await middleware(createRequest("/dashboard/settings"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("callbackUrl=%2Fdashboard%2Fsettings");
  });

  it("allows /dashboard access with valid session", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", name: "Test" } });
    const res = await middleware(createRequest("/dashboard"));
    expect(res.status).toBe(200);
  });

  it("allows nested dashboard routes with valid session", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    const res = await middleware(createRequest("/dashboard/backup"));
    expect(res.status).toBe(200);
  });
});

describe("middleware config", () => {
  it("exports a matcher array", () => {
    expect(config.matcher).toBeDefined();
    expect(Array.isArray(config.matcher)).toBe(true);
    expect(config.matcher.length).toBeGreaterThan(0);
  });
});
