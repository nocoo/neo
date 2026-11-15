"use client";

/**
 * ExportDialog — allows users to export secrets in various formats.
 */

import { CodeBlock } from "@nocoo/basalt/components/code";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nocoo/basalt/components/select";
import { Check, Copy, Download, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
  /** Optional element that should regain focus after the dialog closes. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

// ── Component ────────────────────────────────────────────────────────────

export function ExportDialog({
  open,
  onClose,
  onExport,
  exportOutput,
  error,
  returnFocusRef,
}: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("otpauth-uri");
  const [copied, setCopied] = useState(false);
  const triggerFocusRef = useRef<HTMLElement | null>(null);

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
    const ext =
      selectedFormat === "generic-csv" ? "csv" : selectedFormat === "generic-txt" ? "txt" : "json";
    a.download = `secrets-export.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportOutput, selectedFormat]);

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent
        aria-label="Export secrets"
        onOpenAutoFocus={() => {
          triggerFocusRef.current =
            returnFocusRef?.current ??
            (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (triggerFocusRef.current?.isConnected) triggerFocusRef.current.focus();
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <DialogTitle className="text-lg font-semibold">Export Secrets</DialogTitle>
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
            <Select
              value={selectedFormat}
              onValueChange={(value) => setSelectedFormat(value as ExportFormat)}
            >
              <SelectTrigger id="export-format" aria-label="Export Format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPORT_FORMATS.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <CodeBlock copyable={false} className="max-h-48 font-mono">
                {exportOutput}
              </CodeBlock>
            </div>
          )}

          {error && (
            <p className="text-sm text-basalt-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
