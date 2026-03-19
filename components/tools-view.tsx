"use client";

/**
 * ToolsView — developer tools for import/export and OTP testing.
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { TestTube, Upload, Download } from "lucide-react";
import { useDevToolsViewModel } from "@/viewmodels/useDevToolsViewModel";
import { ImportDialog } from "@/components/import-dialog";
import { ExportDialog } from "@/components/export-dialog";
import { useSecretsViewModel } from "@/viewmodels/useSecretsViewModel";

// ── Component ────────────────────────────────────────────────────────────

export function ToolsView() {
  const devTools = useDevToolsViewModel();
  const secretsVM = useSecretsViewModel();

  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // OTP test state
  const [testSecret, setTestSecret] = useState("");
  const [testDigits, setTestDigits] = useState("6");
  const [testPeriod, setTestPeriod] = useState("30");

  const handleTestOtp = useCallback(async () => {
    await devTools.handleTestOtp(testSecret, {
      digits: parseInt(testDigits, 10),
      period: parseInt(testPeriod, 10),
    });
  }, [devTools, testSecret, testDigits, testPeriod]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Developer Tools</h1>
        <p className="text-sm text-muted-foreground">
          Import, export, and test OTP secrets
        </p>
      </div>

      {/* Error banner */}
      {devTools.error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {devTools.error}
          <button
            type="button"
            onClick={devTools.clearError}
            className="ml-2 underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tool cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Import */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-medium">Import</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Import secrets from other authenticator apps
          </p>
          <Button variant="outline" onClick={() => setShowImport(true)} className="w-full">
            Open Import Tool
          </Button>
        </div>

        {/* Export */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-medium">Export</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Export your secrets in various formats
          </p>
          <Button variant="outline" onClick={() => setShowExport(true)} className="w-full">
            Open Export Tool
          </Button>
        </div>

        {/* OTP Tester */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <TestTube className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-medium">OTP Tester</h2>
          </div>
          <div className="space-y-2">
            <input
              type="text"
              value={testSecret}
              onChange={(e) => setTestSecret(e.target.value)}
              placeholder="Base32 secret key"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              aria-label="Test secret key"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={testDigits}
                onChange={(e) => setTestDigits(e.target.value)}
                className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm"
                aria-label="Digits"
                min="4"
                max="8"
              />
              <input
                type="number"
                value={testPeriod}
                onChange={(e) => setTestPeriod(e.target.value)}
                className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm"
                aria-label="Period"
                min="15"
                max="120"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleTestOtp}
              disabled={!testSecret.trim() || devTools.busy}
              className="w-full"
            >
              Generate Test OTP
            </Button>
            {devTools.otpTestResult && (
              <div className="text-center">
                <span className="font-mono text-2xl font-bold tracking-widest" data-testid="otp-test-result">
                  {devTools.otpTestResult}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ImportDialog
        open={showImport}
        onClose={() => {
          setShowImport(false);
          devTools.clearParsed();
        }}
        onParse={devTools.handleParseImport}
        onImport={secretsVM.handleBatchImport}
        parsedSecrets={devTools.parsedSecrets}
        detectedFormat={devTools.detectedFormat}
        error={devTools.error}
        busy={secretsVM.busy}
      />

      <ExportDialog
        open={showExport}
        onClose={() => {
          setShowExport(false);
          devTools.clearExport();
        }}
        onExport={devTools.handleExport}
        exportOutput={devTools.exportOutput}
        error={devTools.error}
      />
    </div>
  );
}
