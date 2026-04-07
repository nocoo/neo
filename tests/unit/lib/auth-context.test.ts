/**
 * Auth context utility tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockAuth } = vi.hoisted(() => {
  return { mockAuth: vi.fn() };
});

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/db/scoped", () => ({
  ScopedDB: class MockScopedDB {
    userId: string;
    constructor(userId: string) {
      this.userId = userId;
    }
  },
}));

// React.cache is a no-op identity wrapper in test env
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));

describe("auth-context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.E2E_SKIP_AUTH;
    vi.stubEnv("NODE_ENV", "test");
  });

  // ── getSession ──────────────────────────────────────────────────────────

  describe("getSession", () => {
    it("returns session from auth()", async () => {
      const { getSession } = await import("@/lib/auth-context");
      const session = { user: { id: "u1", name: "Test" } };
      mockAuth.mockResolvedValue(session);
      expect(await getSession()).toBe(session);
    });

    it("returns null when auth() returns null", async () => {
      const { getSession } = await import("@/lib/auth-context");
      mockAuth.mockResolvedValue(null);
      expect(await getSession()).toBeNull();
    });
  });

  // ── getScopedDB ─────────────────────────────────────────────────────────

  describe("getScopedDB", () => {
    it("returns ScopedDB for authenticated user", async () => {
      const { getScopedDB } = await import("@/lib/auth-context");
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      const db = await getScopedDB();
      expect(db).toBeDefined();
      expect((db as unknown as { userId: string }).userId).toBe("u1");
    });

    it("returns null when no session", async () => {
      const { getScopedDB } = await import("@/lib/auth-context");
      mockAuth.mockResolvedValue(null);
      expect(await getScopedDB()).toBeNull();
    });

    it("returns null when session has no user id", async () => {
      const { getScopedDB } = await import("@/lib/auth-context");
      mockAuth.mockResolvedValue({ user: {} });
      expect(await getScopedDB()).toBeNull();
    });
  });

  // ── getAuthContext ──────────────────────────────────────────────────────

  describe("getAuthContext", () => {
    it("returns db and userId for authenticated user", async () => {
      const { getAuthContext } = await import("@/lib/auth-context");
      mockAuth.mockResolvedValue({ user: { id: "u2" } });
      const ctx = await getAuthContext();
      expect(ctx).toBeDefined();
      expect(ctx!.userId).toBe("u2");
      expect(ctx!.db).toBeDefined();
    });

    it("returns null when not authenticated", async () => {
      const { getAuthContext } = await import("@/lib/auth-context");
      mockAuth.mockResolvedValue(null);
      expect(await getAuthContext()).toBeNull();
    });
  });

  // ── requireAuth ─────────────────────────────────────────────────────────

  describe("requireAuth", () => {
    it("returns userId for authenticated user", async () => {
      const { requireAuth } = await import("@/lib/auth-context");
      mockAuth.mockResolvedValue({ user: { id: "u3" } });
      expect(await requireAuth()).toBe("u3");
    });

    it("returns null when not authenticated", async () => {
      const { requireAuth } = await import("@/lib/auth-context");
      mockAuth.mockResolvedValue(null);
      expect(await requireAuth()).toBeNull();
    });

    it("returns null when session has no user id", async () => {
      const { requireAuth } = await import("@/lib/auth-context");
      mockAuth.mockResolvedValue({ user: {} });
      expect(await requireAuth()).toBeNull();
    });
  });

  // ── E2E mode ────────────────────────────────────────────────────────────

  describe("E2E mode", () => {
    it("returns test user when E2E_SKIP_AUTH=true in non-production", async () => {
      vi.stubEnv("NODE_ENV", "test");
      process.env.E2E_SKIP_AUTH = "true";
      const { getSession } = await import("@/lib/auth-context");
      const session = await getSession();
      expect(session?.user?.id).toBe("e2e-test-user");
      expect(mockAuth).not.toHaveBeenCalled();
    });

    it("ignores E2E_SKIP_AUTH in production (production guard)", async () => {
      vi.stubEnv("NODE_ENV", "production");
      process.env.E2E_SKIP_AUTH = "true";
      const { getSession } = await import("@/lib/auth-context");
      mockAuth.mockResolvedValue(null);
      const session = await getSession();
      expect(session).toBeNull();
      expect(mockAuth).toHaveBeenCalled();
    });

    it("does not use E2E mode when E2E_SKIP_AUTH is not set", async () => {
      vi.stubEnv("NODE_ENV", "test");
      delete process.env.E2E_SKIP_AUTH;
      const { getSession } = await import("@/lib/auth-context");
      mockAuth.mockResolvedValue({ user: { id: "real-user" } });
      const session = await getSession();
      expect(session?.user?.id).toBe("real-user");
      expect(mockAuth).toHaveBeenCalled();
    });
  });
});
