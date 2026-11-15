"use client";

/**
 * ImportDialog — allows users to import secrets from various formats.
 */

import { Upload, X } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { InputArea } from "@/components/ui/input-area";
import type { ImportFormat, ParsedSecret } from "@/models/types";

// ── Types ────────────────────────────────────────────────────────────────

export interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onParse: (content: string, format?: ImportFormat) => void;
  onImport: (
    secrets: { name: string; secret: string; account?: string }[],
  ) => Promise<{ imported: number; skipped: number; duplicates: number } | null>;
  parsedSecrets: ParsedSecret[];
  detectedFormat: ImportFormat | null;
  error: string | null;
  busy?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────

export function ImportDialog({
  open,
  onClose,
  onParse,
  onImport,
  parsedSecrets,
  detectedFormat,
  error,
  busy = false,
}: ImportDialogProps) {
  const [content, setContent] = useState("");

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setContent(text);
        onParse(text);
      };
      reader.readAsText(file);
    },
    [onParse],
  );

  const handlePaste = useCallback(() => {
    if (content.trim()) {
      onParse(content);
    }
  }, [content, onParse]);

  const handleImport = useCallback(async () => {
    const input = parsedSecrets.map((s) => ({
      name: s.name,
      secret: s.secret,
      ...(s.account ? { account: s.account } : {}),
    }));
    const result = await onImport(input);
    if (result) {
      onClose();
    }
  }, [parsedSecrets, onImport, onClose]);

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent size="lg" aria-label="Import secrets">
        <div className="flex items-center justify-between mb-4">
          <DialogTitle className="text-lg font-semibold">Import Secrets</DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* File upload */}
          <div>
            <label
              htmlFor="import-file"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-basalt-border p-6 text-sm text-basalt-muted-foreground hover:border-basalt-primary transition-colors"
            >
              <Upload className="h-5 w-5" />
              <span>Drop a file or click to upload</span>
            </label>
            <input
              id="import-file"
              type="file"
              accept=".json,.txt,.csv,.rtf"
              onChange={handleFileUpload}
              className="hidden"
              aria-label="Upload import file"
            />
          </div>

          {/* Or paste content */}
          <div>
            <label htmlFor="import-content" className="block text-sm font-medium mb-1">
              Or paste content
            </label>
            <InputArea
              id="import-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste otpauth:// URIs, JSON, or CSV..."
              rows={4}
              className="w-full font-mono"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handlePaste}
              className="mt-2"
              disabled={!content.trim()}
            >
              Parse
            </Button>
          </div>

          {/* Results */}
          {detectedFormat && (
            <p className="text-sm text-basalt-muted-foreground">
              Detected format: <strong>{detectedFormat}</strong>
            </p>
          )}

          {parsedSecrets.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">
                Found {parsedSecrets.length} secret{parsedSecrets.length !== 1 ? "s" : ""}
              </p>
              <ul className="max-h-40 overflow-y-auto space-y-1" aria-label="Parsed secrets">
                {parsedSecrets.map((s) => (
                  <li
                    key={`${s.name}::${s.account ?? ""}::${s.secret}`}
                    className="text-xs text-basalt-muted-foreground"
                  >
                    {s.name}
                    {s.account ? ` (${s.account})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p className="text-sm text-basalt-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={parsedSecrets.length === 0 || busy}>
              {busy
                ? "Importing..."
                : `Import ${parsedSecrets.length} Secret${parsedSecrets.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
