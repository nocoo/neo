/**
 * ExportDialog component tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExportDialog } from "@/components/export-dialog";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ExportDialog", () => {
  it("renders nothing when not open", () => {
    const { container } = render(
      <ExportDialog
        open={false}
        onClose={vi.fn()}
        onExport={vi.fn()}
        exportOutput=""
        error={null}
      />
    );
    expect(container.querySelector("[role='dialog']")).toBeNull();
  });

  it("renders export form with format selector", () => {
    render(
      <ExportDialog
        open={true}
        onClose={vi.fn()}
        onExport={vi.fn()}
        exportOutput=""
        error={null}
      />
    );
    expect(screen.getByText("Export Secrets")).toBeDefined();
    expect(screen.getByLabelText("Export Format")).toBeDefined();
  });

  it("calls onExport with selected format", () => {
    const onExport = vi.fn();
    render(
      <ExportDialog
        open={true}
        onClose={vi.fn()}
        onExport={onExport}
        exportOutput=""
        error={null}
      />
    );

    fireEvent.change(screen.getByLabelText("Export Format"), {
      target: { value: "aegis" },
    });
    fireEvent.click(screen.getByText("Generate Export"));

    expect(onExport).toHaveBeenCalledWith("aegis");
  });

  it("shows export output", () => {
    render(
      <ExportDialog
        open={true}
        onClose={vi.fn()}
        onExport={vi.fn()}
        exportOutput='{"secrets": []}'
        error={null}
      />
    );
    expect(screen.getByText('{"secrets": []}')).toBeDefined();
  });

  it("shows copy and download buttons when output available", () => {
    render(
      <ExportDialog
        open={true}
        onClose={vi.fn()}
        onExport={vi.fn()}
        exportOutput="data"
        error={null}
      />
    );
    expect(screen.getByText("Copy")).toBeDefined();
    expect(screen.getByText("Download")).toBeDefined();
  });

  it("copies output to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <ExportDialog
        open={true}
        onClose={vi.fn()}
        onExport={vi.fn()}
        exportOutput="export-data"
        error={null}
      />
    );

    fireEvent.click(screen.getByText("Copy"));
    expect(writeText).toHaveBeenCalledWith("export-data");
  });

  it("shows error message", () => {
    render(
      <ExportDialog
        open={true}
        onClose={vi.fn()}
        onExport={vi.fn()}
        exportOutput=""
        error="Export failed"
      />
    );
    expect(screen.getByText("Export failed")).toBeDefined();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(
      <ExportDialog
        open={true}
        onClose={onClose}
        onExport={vi.fn()}
        exportOutput=""
        error={null}
      />
    );

    fireEvent.click(screen.getByLabelText("Close dialog"));
    expect(onClose).toHaveBeenCalled();
  });
});
