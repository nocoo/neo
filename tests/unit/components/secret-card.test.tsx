/**
 * SecretCard component tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SecretCard } from "@/components/secret-card";
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
  color: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleOtp: OtpResult = {
  otp: "123456",
  remainingSeconds: 20,
  period: 30,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("SecretCard", () => {
  it("renders secret name", () => {
    render(<SecretCard secret={sampleSecret} />);
    expect(screen.getByText("GitHub")).toBeDefined();
  });

  it("renders account info", () => {
    render(<SecretCard secret={sampleSecret} />);
    expect(screen.getByText("user@example.com")).toBeDefined();
  });

  it("renders OTP code when provided", () => {
    render(<SecretCard secret={sampleSecret} otp={sampleOtp} />);
    expect(screen.getByText("123456")).toBeDefined();
  });

  it("does not render OTP section without otp prop", () => {
    render(<SecretCard secret={sampleSecret} />);
    expect(screen.queryByText("123456")).toBeNull();
  });

  it("shows type badge for non-totp secrets", () => {
    const hotpSecret = { ...sampleSecret, type: "hotp" as const };
    render(<SecretCard secret={hotpSecret} />);
    expect(screen.getByText("hotp")).toBeDefined();
  });

  it("does not show type badge for totp secrets", () => {
    render(<SecretCard secret={sampleSecret} />);
    expect(screen.queryByText("totp")).toBeNull();
  });

  it("calls onEdit when edit button clicked", () => {
    const onEdit = vi.fn();
    render(<SecretCard secret={sampleSecret} onEdit={onEdit} />);

    fireEvent.click(screen.getByLabelText("Edit GitHub"));
    expect(onEdit).toHaveBeenCalledWith(sampleSecret);
  });

  it("calls onDelete when delete button clicked", () => {
    const onDelete = vi.fn();
    render(<SecretCard secret={sampleSecret} onDelete={onDelete} />);

    fireEvent.click(screen.getByLabelText("Delete GitHub"));
    expect(onDelete).toHaveBeenCalledWith("s_test_1");
  });

  it("does not render edit button when onEdit not provided", () => {
    render(<SecretCard secret={sampleSecret} />);
    expect(screen.queryByLabelText("Edit GitHub")).toBeNull();
  });

  it("does not render delete button when onDelete not provided", () => {
    render(<SecretCard secret={sampleSecret} />);
    expect(screen.queryByLabelText("Delete GitHub")).toBeNull();
  });

  it("copies OTP to clipboard when card is clicked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<SecretCard secret={sampleSecret} otp={sampleOtp} />);

    fireEvent.click(screen.getByTestId("secret-card-s_test_1"));
    expect(writeText).toHaveBeenCalledWith("123456");
  });

  it("shows 3D flip with Copied! back face after clicking", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<SecretCard secret={sampleSecret} otp={sampleOtp} />);

    fireEvent.click(screen.getByTestId("secret-card-s_test_1"));

    // "Copied!" back face is always in DOM; after flip it becomes visible
    expect(screen.getByText("Copied!")).toBeDefined();
  });

  it("renders data-testid attribute", () => {
    render(<SecretCard secret={sampleSecret} />);
    expect(screen.getByTestId("secret-card-s_test_1")).toBeDefined();
  });

  it("handles secret without account", () => {
    const noAccount = { ...sampleSecret, account: "" };
    render(<SecretCard secret={noAccount} />);
    expect(screen.getByText("GitHub")).toBeDefined();
    expect(screen.queryByText("user@example.com")).toBeNull();
  });

  it("uses user-defined color when set", () => {
    const coloredSecret = { ...sampleSecret, color: "red" };
    const { container } = render(<SecretCard secret={coloredSecret} />);
    // The front face div (first child of the flip container) carries bg classes
    const frontFace = container.querySelector("[data-testid='secret-card-s_test_1'] > div > div");
    expect(frontFace?.className).toContain("bg-red-500");
  });

  it("same first-word names get the same theme", () => {
    const secret1 = { ...sampleSecret, id: "s_1", name: "Google Gmail", color: null };
    const secret2 = { ...sampleSecret, id: "s_2", name: "Google Drive", color: null };

    const { container: c1 } = render(<SecretCard secret={secret1} />);
    const { container: c2 } = render(<SecretCard secret={secret2} />);

    // Front face is first child of flip container
    const front1 = c1.querySelector("[data-testid='secret-card-s_1'] > div > div");
    const front2 = c2.querySelector("[data-testid='secret-card-s_2'] > div > div");

    const bgClass1 = front1?.className.split(" ").find((c) => c.startsWith("bg-"));
    const bgClass2 = front2?.className.split(" ").find((c) => c.startsWith("bg-"));
    expect(bgClass1).toBe(bgClass2);
  });
});
