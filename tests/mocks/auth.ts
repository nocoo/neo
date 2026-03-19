/**
 * Mock NextAuth session for tests.
 */
import { vi } from "vitest";

export const mockSession = {
  user: {
    id: "test-user-id",
    name: "Test User",
    email: "test@example.com",
    image: null,
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

export function mockAuth(session = mockSession) {
  vi.mock("@/auth", () => ({
    auth: vi.fn().mockResolvedValue(session),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }));
}

export function mockUnauthenticated() {
  vi.mock("@/auth", () => ({
    auth: vi.fn().mockResolvedValue(null),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }));
}
