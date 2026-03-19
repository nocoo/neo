/**
 * SecretList component tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SecretList } from "@/components/secret-list";
import type { Secret, OtpResult } from "@/models/types";

// ── Helpers ──────────────────────────────────────────────────────────────

const sampleSecret: Secret = {
  id: "s_test_1",
  userId: "test-user",
  name: "GitHub",
  account: "user@example.com",
  secret: "JBSWY3DPEHPK3PXP",
  type: "totp",
  digits: 6,
  period: 30,
  algorithm: "SHA-1",
  counter: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleSecret2: Secret = {
  ...sampleSecret,
  id: "s_test_2",
  name: "GitLab",
  account: "admin@gitlab.com",
};

const otpMap = new Map<string, OtpResult>([
  ["s_test_1", { otp: "123456", remainingSeconds: 20, period: 30 }],
  ["s_test_2", { otp: "654321", remainingSeconds: 15, period: 30 }],
]);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("SecretList", () => {
  it("renders search input", () => {
    render(
      <SecretList
        secrets={[]}
        otpMap={new Map()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Search secrets")).toBeDefined();
  });

  it("renders all secrets", () => {
    render(
      <SecretList
        secrets={[sampleSecret, sampleSecret2]}
        otpMap={otpMap}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );
    expect(screen.getByText("GitHub")).toBeDefined();
    expect(screen.getByText("GitLab")).toBeDefined();
  });

  it("shows empty state when no secrets", () => {
    render(
      <SecretList
        secrets={[]}
        otpMap={new Map()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );
    expect(
      screen.getByText("No secrets yet. Add your first secret to get started.")
    ).toBeDefined();
  });

  it("shows search empty state when filtering returns nothing", () => {
    render(
      <SecretList
        secrets={[]}
        otpMap={new Map()}
        searchQuery="nonexistent"
        onSearchChange={vi.fn()}
      />
    );
    expect(screen.getByText("No secrets match your search.")).toBeDefined();
  });

  it("calls onSearchChange when typing", () => {
    const onSearchChange = vi.fn();
    render(
      <SecretList
        secrets={[sampleSecret]}
        otpMap={otpMap}
        searchQuery=""
        onSearchChange={onSearchChange}
      />
    );

    fireEvent.change(screen.getByLabelText("Search secrets"), {
      target: { value: "git" },
    });
    expect(onSearchChange).toHaveBeenCalledWith("git");
  });

  it("passes OTP to cards", () => {
    render(
      <SecretList
        secrets={[sampleSecret]}
        otpMap={otpMap}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );
    expect(screen.getByText("123456")).toBeDefined();
  });

  it("passes onEdit and onDelete to cards", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <SecretList
        secrets={[sampleSecret]}
        otpMap={otpMap}
        searchQuery=""
        onSearchChange={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByLabelText("Edit GitHub"));
    expect(onEdit).toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Delete GitHub"));
    expect(onDelete).toHaveBeenCalled();
  });

  it("renders list with proper aria roles", () => {
    render(
      <SecretList
        secrets={[sampleSecret]}
        otpMap={otpMap}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );
    expect(screen.getByRole("list")).toBeDefined();
    expect(screen.getByRole("listitem")).toBeDefined();
  });
});
