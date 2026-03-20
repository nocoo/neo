/**
 * SecretFormDialog component tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SecretFormDialog } from "@/components/secret-form-dialog";
import type { Secret } from "@/models/types";

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

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("SecretFormDialog", () => {
  describe("create mode", () => {
    it("renders create form", () => {
      render(
        <SecretFormDialog open={true} onClose={vi.fn()} onCreate={vi.fn()} />
      );
      expect(screen.getByText("Add Secret")).toBeDefined();
      expect(screen.getByLabelText("Name *")).toBeDefined();
      expect(screen.getByLabelText("Secret Key *")).toBeDefined();
    });

    it("shows validation error when name is empty", async () => {
      const onCreate = vi.fn();
      render(
        <SecretFormDialog open={true} onClose={vi.fn()} onCreate={onCreate} />
      );

      await act(async () => {
        fireEvent.submit(screen.getByText("Create").closest("form")!);
      });

      expect(screen.getByText("Name is required")).toBeDefined();
      expect(onCreate).not.toHaveBeenCalled();
    });

    it("shows validation error when secret is empty", async () => {
      const onCreate = vi.fn();
      render(
        <SecretFormDialog open={true} onClose={vi.fn()} onCreate={onCreate} />
      );

      fireEvent.change(screen.getByLabelText("Name *"), {
        target: { value: "GitHub" },
      });

      await act(async () => {
        fireEvent.submit(screen.getByText("Create").closest("form")!);
      });

      expect(screen.getByText("Secret key is required")).toBeDefined();
    });

    it("calls onCreate with input on valid submission", async () => {
      const onCreate = vi.fn().mockResolvedValue(true);
      const onClose = vi.fn();

      render(
        <SecretFormDialog
          open={true}
          onClose={onClose}
          onCreate={onCreate}
        />
      );

      fireEvent.change(screen.getByLabelText("Name *"), {
        target: { value: "GitHub" },
      });
      fireEvent.change(screen.getByLabelText("Secret Key *"), {
        target: { value: "JBSWY3DPEHPK3PXP" },
      });

      await act(async () => {
        fireEvent.submit(screen.getByText("Create").closest("form")!);
      });

      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "GitHub",
          secret: "JBSWY3DPEHPK3PXP",
        })
      );
      expect(onClose).toHaveBeenCalled();
    });

    it("does not close on failed creation", async () => {
      const onCreate = vi.fn().mockResolvedValue(false);
      const onClose = vi.fn();

      render(
        <SecretFormDialog open={true} onClose={onClose} onCreate={onCreate} />
      );

      fireEvent.change(screen.getByLabelText("Name *"), {
        target: { value: "GitHub" },
      });
      fireEvent.change(screen.getByLabelText("Secret Key *"), {
        target: { value: "JBSWY3DPEHPK3PXP" },
      });

      await act(async () => {
        fireEvent.submit(screen.getByText("Create").closest("form")!);
      });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("edit mode", () => {
    it("renders edit form with prefilled values", () => {
      render(
        <SecretFormDialog
          open={true}
          secret={sampleSecret}
          onClose={vi.fn()}
          onUpdate={vi.fn()}
        />
      );
      expect(screen.getByText("Edit Secret")).toBeDefined();
      expect(screen.getByDisplayValue("GitHub")).toBeDefined();
      expect(screen.getByDisplayValue("user@example.com")).toBeDefined();
      // Secret key field should not be visible in edit mode
      expect(screen.queryByLabelText("Secret Key *")).toBeNull();
    });

    it("calls onUpdate with input", async () => {
      const onUpdate = vi.fn().mockResolvedValue(true);
      const onClose = vi.fn();

      render(
        <SecretFormDialog
          open={true}
          secret={sampleSecret}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      );

      fireEvent.change(screen.getByDisplayValue("GitHub"), {
        target: { value: "GitHub Enterprise" },
      });

      await act(async () => {
        fireEvent.submit(screen.getByText("Update").closest("form")!);
      });

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "s_test_1",
          name: "GitHub Enterprise",
        })
      );
      expect(onClose).toHaveBeenCalled();
    });

    it("prefills color when editing a secret with color", () => {
      const coloredSecret = { ...sampleSecret, color: "blue" };
      render(
        <SecretFormDialog
          open={true}
          secret={coloredSecret}
          onClose={vi.fn()}
          onUpdate={vi.fn()}
        />
      );

      const blueRadio = screen.getByLabelText("Blue");
      expect(blueRadio.getAttribute("aria-checked")).toBe("true");
    });
  });

  describe("color picker", () => {
    it("renders color picker with all options", () => {
      render(
        <SecretFormDialog open={true} onClose={vi.fn()} onCreate={vi.fn()} />
      );
      expect(screen.getByText("Color")).toBeDefined();
      expect(screen.getByLabelText("Red")).toBeDefined();
      expect(screen.getByLabelText("Blue")).toBeDefined();
      expect(screen.getByLabelText("White")).toBeDefined();
      expect(screen.getByLabelText("Black")).toBeDefined();
    });

    it("selects a color when clicked", () => {
      render(
        <SecretFormDialog open={true} onClose={vi.fn()} onCreate={vi.fn()} />
      );

      fireEvent.click(screen.getByLabelText("Red"));
      expect(screen.getByLabelText("Red").getAttribute("aria-checked")).toBe("true");
      expect(screen.getByLabelText("Blue").getAttribute("aria-checked")).toBe("false");
    });

    it("includes color in create submission", async () => {
      const onCreate = vi.fn().mockResolvedValue(true);

      render(
        <SecretFormDialog open={true} onClose={vi.fn()} onCreate={onCreate} />
      );

      fireEvent.change(screen.getByLabelText("Name *"), {
        target: { value: "Test" },
      });
      fireEvent.change(screen.getByLabelText("Secret Key *"), {
        target: { value: "JBSWY3DPEHPK3PXP" },
      });
      fireEvent.click(screen.getByLabelText("Purple"));

      await act(async () => {
        fireEvent.submit(screen.getByText("Create").closest("form")!);
      });

      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          color: "purple",
        })
      );
    });

    it("includes color in update submission", async () => {
      const onUpdate = vi.fn().mockResolvedValue(true);
      const coloredSecret = { ...sampleSecret, color: "blue" };

      render(
        <SecretFormDialog
          open={true}
          secret={coloredSecret}
          onClose={vi.fn()}
          onUpdate={onUpdate}
        />
      );

      // Switch color from blue to orange
      fireEvent.click(screen.getByLabelText("Orange"));

      await act(async () => {
        fireEvent.submit(screen.getByText("Update").closest("form")!);
      });

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          color: "orange",
        })
      );
    });

    it("resolves hash color when secret has no explicit color", () => {
      // sampleSecret has color: null, so resolveThemeKey computes from name
      render(
        <SecretFormDialog
          open={true}
          secret={sampleSecret}
          onClose={vi.fn()}
          onUpdate={vi.fn()}
        />
      );

      // At least one color radio should be checked (the hash-derived color)
      const allRadios = screen.getAllByRole("radio");
      const checkedRadio = allRadios.find(
        (r) => r.getAttribute("aria-checked") === "true"
      );
      expect(checkedRadio).toBeDefined();
    });
  });

  describe("dialog behavior", () => {
    it("renders nothing when not open", () => {
      const { container } = render(
        <SecretFormDialog open={false} onClose={vi.fn()} />
      );
      expect(container.querySelector("[role='dialog']")).toBeNull();
    });

    it("calls onClose when close button clicked", () => {
      const onClose = vi.fn();
      render(<SecretFormDialog open={true} onClose={onClose} />);

      fireEvent.click(screen.getByLabelText("Close dialog"));
      expect(onClose).toHaveBeenCalled();
    });

    it("calls onClose when cancel clicked", () => {
      const onClose = vi.fn();
      render(<SecretFormDialog open={true} onClose={onClose} />);

      fireEvent.click(screen.getByText("Cancel"));
      expect(onClose).toHaveBeenCalled();
    });

    it("shows busy state", () => {
      render(
        <SecretFormDialog open={true} onClose={vi.fn()} busy={true} />
      );
      expect(screen.getByText("Saving...")).toBeDefined();
    });
  });
});
