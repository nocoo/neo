/**
 * Auth context utility tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { getSession, getScopedDB, getAuthContext, requireAuth } from "@/lib/auth-context";

describe("auth-context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getSession ──────────────────────────────────────────────────────────

  describe("getSession", () => {
    it("returns session from auth()", async () => {
      const session = { user: { id: "u1", name: "Test" } };
      mockAuth.mockResolvedValue(session);
      expect(await getSession()).toBe(session);
    });

    it("returns null when auth() returns null", async () => {
      mockAuth.mockResolvedValue(null);
      expect(await getSession()).toBeNull();
    });
  });

  // ── getScopedDB ─────────────────────────────────────────────────────────

  describe("getScopedDB", () => {
    it("returns ScopedDB for authenticated user", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      const db = await getScopedDB();
      expect(db).toBeDefined();
      expect((db as unknown as { userId: string }).userId).toBe("u1");
    });

    it("returns null when no session", async () => {
      mockAuth.mockResolvedValue(null);
      expect(await getScopedDB()).toBeNull();
    });

    it("returns null when session has no user id", async () => {
      mockAuth.mockResolvedValue({ user: {} });
      expect(await getScopedDB()).toBeNull();
    });
  });

  // ── getAuthContext ──────────────────────────────────────────────────────

  describe("getAuthContext", () => {
    it("returns db and userId for authenticated user", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u2" } });
      const ctx = await getAuthContext();
      expect(ctx).toBeDefined();
      expect(ctx!.userId).toBe("u2");
      expect(ctx!.db).toBeDefined();
    });

    it("returns null when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      expect(await getAuthContext()).toBeNull();
    });
  });

  // ── requireAuth ─────────────────────────────────────────────────────────

  describe("requireAuth", () => {
    it("returns userId for authenticated user", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u3" } });
      expect(await requireAuth()).toBe("u3");
    });

    it("returns null when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      expect(await requireAuth()).toBeNull();
    });

    it("returns null when session has no user id", async () => {
      mockAuth.mockResolvedValue({ user: {} });
      expect(await requireAuth()).toBeNull();
    });
  });
});
