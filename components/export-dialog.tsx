"use client";

/**
 * ExportDialog — allows users to export secrets in various formats.
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Download, X } from "lucide-react";
import type { ExportFormat } from "@/models/types";

// ── Types ────────────────────────────────────────────────────────────────

const EXPORT_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "otpauth-uri", label: "OTPAuth URIs" },
  { value: "aegis", label: "Aegis" },
  { value: "2fas", label: "2FAS" },
  { value: "andotp", label: "andOTP" },
  { value: "bitwarden", label: "Bitwarden" },
  { value: "lastpass", label: "LastPass" },
  { value: "generic-json", label: "Generic JSON" },
  { value: "generic-csv", label: "CSV" },
];

export interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (format: ExportFormat) => void;
  exportOutput: string;
  error: string | null;
}

// ── Component ────────────────────────────────────────────────────────────

export function ExportDialog({
  open,
  onClose,
  onExport,
  exportOutput,
  error,
}: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("otpauth-uri");
  const [copied, setCopied] = useState(false);

  const handleExport = useCallback(() => {
    onExport(selectedFormat);
  }, [onExport, selectedFormat]);

  const handleCopy = useCallback(async () => {
    if (!exportOutput) return;
    try {
      await navigator.clipboard.writeText(exportOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  }, [exportOutput]);

  const handleDownload = useCallback(() => {
    if (!exportOutput) return;
    const blob = new Blob([exportOutput], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ext = selectedFormat === "generic-csv" ? "csv" : selectedFormat === "generic-txt" ? "txt" : "json";
    a.download = `secrets-export.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportOutput, selectedFormat]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Export secrets"
    >
      <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Export Secrets</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Format selection */}
          <div>
            <label htmlFor="export-format" className="block text-sm font-medium mb-1">
              Export Format
            </label>
            <select
              id="export-format"
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {EXPORT_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={handleExport} className="w-full">
            Generate Export
          </Button>

          {/* Output */}
          {exportOutput && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Output</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? (
                      <Check className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 mr-1" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDownload}>
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
              <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs font-mono">
                {exportOutput}
              </pre>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
