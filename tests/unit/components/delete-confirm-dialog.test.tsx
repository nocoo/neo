/**
 * DeleteConfirmDialog component tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeleteConfirmDialog", () => {
  it("renders nothing when not open", () => {
    const { container } = render(
      <DeleteConfirmDialog
        open={false}
        secretName="GitHub"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(container.querySelector("[role='dialog']")).toBeNull();
  });

  it("renders confirmation message with secret name", () => {
    render(
      <DeleteConfirmDialog
        open={true}
        secretName="GitHub"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText("Delete Secret")).toBeDefined();
    expect(screen.getByText("GitHub")).toBeDefined();
  });

  it("calls onConfirm when delete clicked", () => {
    const onConfirm = vi.fn();
    render(
      <DeleteConfirmDialog
        open={true}
        secretName="GitHub"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByText("Delete"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onClose when cancel clicked", () => {
    const onClose = vi.fn();
    render(
      <DeleteConfirmDialog
        open={true}
        secretName="GitHub"
        onClose={onClose}
        onConfirm={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows busy state", () => {
    render(
      <DeleteConfirmDialog
        open={true}
        secretName="GitHub"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        busy={true}
      />
    );
    expect(screen.getByText("Deleting...")).toBeDefined();
  });
});
