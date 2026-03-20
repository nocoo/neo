/**
 * Dashboard context tests.
 */

import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { type ReactNode } from "react";

// Mock getDashboardData before importing the context
vi.mock("@/actions/dashboard", () => ({
  getDashboardData: vi.fn().mockResolvedValue({
    success: true,
    data: {
      secrets: [],
      encryptionEnabled: false,
    },
  }),
}));

import {
  DashboardProvider,
  useDashboardState,
  useDashboardActions,
  useDashboardService,
} from "@/contexts/dashboard-context";
import type { Secret } from "@/models/types";

// ── Helper ──────────────────────────────────────────────────────────────

const sampleSecret: Secret = {
  id: "s_test_1",
  userId: "test-user-id",
  name: "GitHub",
  account: "user@example.com",
  secret: "JBSWY3DPEHPK3PXP",
  type: "totp",
  digits: 6,
  period: 30,
  algorithm: "SHA-1",
  counter: 0,
  color: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const initialData = {
  secrets: [sampleSecret],
  encryptionEnabled: true,
};

function createWrapper(props?: { initialData?: typeof initialData }) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <DashboardProvider initialData={props?.initialData}>
        {children}
      </DashboardProvider>
    );
  };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("DashboardProvider", () => {
  it("provides initial data via state hook", () => {
    const { result } = renderHook(() => useDashboardState(), {
      wrapper: createWrapper({ initialData }),
    });

    expect(result.current.secrets).toHaveLength(1);
    expect(result.current.encryptionEnabled).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it("starts loading when no initial data", () => {
    const { result } = renderHook(() => useDashboardState(), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);
  });
});

describe("useDashboardActions", () => {
  it("adds secret via handleSecretCreated", () => {
    const { result: stateResult } = renderHook(() => useDashboardService(), {
      wrapper: createWrapper({ initialData }),
    });

    const newSecret = { ...sampleSecret, id: "s_test_2", name: "GitLab" };

    act(() => {
      stateResult.current.handleSecretCreated(newSecret);
    });

    expect(stateResult.current.secrets).toHaveLength(2);
    expect(stateResult.current.secrets[0].name).toBe("GitLab");
  });

  it("removes secret via handleSecretDeleted", () => {
    const { result } = renderHook(() => useDashboardService(), {
      wrapper: createWrapper({ initialData }),
    });

    act(() => {
      result.current.handleSecretDeleted("s_test_1");
    });

    expect(result.current.secrets).toHaveLength(0);
  });

  it("updates secret via handleSecretUpdated", () => {
    const { result } = renderHook(() => useDashboardService(), {
      wrapper: createWrapper({ initialData }),
    });

    const updated = { ...sampleSecret, name: "GitHub Enterprise" };

    act(() => {
      result.current.handleSecretUpdated(updated);
    });

    expect(result.current.secrets[0].name).toBe("GitHub Enterprise");
  });

  it("replaces all secrets via handleSecretsReloaded", () => {
    const { result } = renderHook(() => useDashboardService(), {
      wrapper: createWrapper({ initialData }),
    });

    const newSecrets = [
      { ...sampleSecret, id: "s_new_1", name: "AWS" },
      { ...sampleSecret, id: "s_new_2", name: "Azure" },
    ];

    act(() => {
      result.current.handleSecretsReloaded(newSecrets);
    });

    expect(result.current.secrets).toHaveLength(2);
    expect(result.current.secrets[0].name).toBe("AWS");
  });

});

describe("context hooks", () => {
  it("throws when used outside provider", () => {
    // useDashboardState without provider
    expect(() => {
      renderHook(() => useDashboardState());
    }).toThrow("useDashboardState must be used within DashboardProvider");
  });

  it("throws useDashboardActions outside provider", () => {
    expect(() => {
      renderHook(() => useDashboardActions());
    }).toThrow("useDashboardActions must be used within DashboardProvider");
  });

  it("useDashboardService returns both state and actions", () => {
    const { result } = renderHook(() => useDashboardService(), {
      wrapper: createWrapper({ initialData }),
    });

    // State fields
    expect(result.current.secrets).toBeDefined();
    expect(result.current.loading).toBeDefined();

    // Action fields
    expect(result.current.handleSecretCreated).toBeInstanceOf(Function);
    expect(result.current.handleSecretDeleted).toBeInstanceOf(Function);
    expect(result.current.refresh).toBeInstanceOf(Function);
  });
});
