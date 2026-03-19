/**
 * ImportDialog component tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ImportDialog } from "@/components/import-dialog";
import type { ParsedSecret } from "@/models/types";

const sampleParsed: ParsedSecret[] = [
  {
    name: "GitHub",
    account: "user@example.com",
    secret: "JBSWY3DPEHPK3PXP",
    type: "totp",
    digits: 6,
    period: 30,
    algorithm: "SHA-1",
    counter: 0,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ImportDialog", () => {
  it("renders nothing when not open", () => {
    const { container } = render(
      <ImportDialog
        open={false}
        onClose={vi.fn()}
        onParse={vi.fn()}
        onImport={vi.fn()}
        parsedSecrets={[]}
        detectedFormat={null}
        error={null}
      />
    );
    expect(container.querySelector("[role='dialog']")).toBeNull();
  });

  it("renders import form", () => {
    render(
      <ImportDialog
        open={true}
        onClose={vi.fn()}
        onParse={vi.fn()}
        onImport={vi.fn()}
        parsedSecrets={[]}
        detectedFormat={null}
        error={null}
      />
    );
    expect(screen.getByText("Import Secrets")).toBeDefined();
    expect(screen.getByLabelText("Or paste content")).toBeDefined();
  });

  it("calls onParse when Parse button clicked", () => {
    const onParse = vi.fn();
    render(
      <ImportDialog
        open={true}
        onClose={vi.fn()}
        onParse={onParse}
        onImport={vi.fn()}
        parsedSecrets={[]}
        detectedFormat={null}
        error={null}
      />
    );

    fireEvent.change(screen.getByLabelText("Or paste content"), {
      target: { value: "otpauth://totp/GitHub?secret=JBSWY3DPEHPK3PXP" },
    });
    fireEvent.click(screen.getByText("Parse"));

    expect(onParse).toHaveBeenCalled();
  });

  it("shows detected format", () => {
    render(
      <ImportDialog
        open={true}
        onClose={vi.fn()}
        onParse={vi.fn()}
        onImport={vi.fn()}
        parsedSecrets={sampleParsed}
        detectedFormat="otpauth-uri"
        error={null}
      />
    );
    expect(screen.getByText("otpauth-uri")).toBeDefined();
  });

  it("shows parsed secrets count", () => {
    render(
      <ImportDialog
        open={true}
        onClose={vi.fn()}
        onParse={vi.fn()}
        onImport={vi.fn()}
        parsedSecrets={sampleParsed}
        detectedFormat="aegis"
        error={null}
      />
    );
    expect(screen.getByText("Found 1 secret")).toBeDefined();
  });

  it("calls onImport when import button clicked", async () => {
    const onImport = vi.fn().mockResolvedValue({ imported: 1, skipped: 0 });
    const onClose = vi.fn();

    render(
      <ImportDialog
        open={true}
        onClose={onClose}
        onParse={vi.fn()}
        onImport={onImport}
        parsedSecrets={sampleParsed}
        detectedFormat="aegis"
        error={null}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Import 1 Secret"));
    });

    expect(onImport).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("disables import button when no parsed secrets", () => {
    render(
      <ImportDialog
        open={true}
        onClose={vi.fn()}
        onParse={vi.fn()}
        onImport={vi.fn()}
        parsedSecrets={[]}
        detectedFormat={null}
        error={null}
      />
    );

    const importBtn = screen.getByText("Import 0 Secrets");
    expect(importBtn.closest("button")?.disabled).toBe(true);
  });

  it("shows error message", () => {
    render(
      <ImportDialog
        open={true}
        onClose={vi.fn()}
        onParse={vi.fn()}
        onImport={vi.fn()}
        parsedSecrets={[]}
        detectedFormat={null}
        error="Invalid format"
      />
    );
    expect(screen.getByText("Invalid format")).toBeDefined();
  });

  it("calls onClose when cancel clicked", () => {
    const onClose = vi.fn();
    render(
      <ImportDialog
        open={true}
        onClose={onClose}
        onParse={vi.fn()}
        onImport={vi.fn()}
        parsedSecrets={[]}
        detectedFormat={null}
        error={null}
      />
    );

    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });
});
