"use client";

/**
 * BackupView — encrypted archive backup management.
 *
 * Three actions:
 *   1. Create & Download — GET /api/backup/archive → browser download
 *   2. Push to Backy — server action → encrypted push to Backy
 *   3. Restore — upload ZIP + encryption key → POST /api/backup/restore
 */

import { useState, useRef } from "react";
import {
  Archive,
  Download,
  Upload,
  Send,
  RefreshCw,
  Check,
  AlertTriangle,
  Key,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBackupViewModel } from "@/viewmodels/useBackupViewModel";
import { useDashboardState } from "@/contexts/dashboard-context";
import { formatFileSize, formatTimeAgo } from "@/models/backy";

// ── Component ────────────────────────────────────────────────────────────

export function BackupView() {
  const vm = useBackupViewModel();
  const { encryptionEnabled } = useDashboardState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreKey, setRestoreKey] = useState("");

  const handleFileRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !restoreKey) return;

    await vm.handleRestore(file, restoreKey);
    setRestoreKey("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">

      {/* Error banner */}
      {vm.error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {vm.error}
          <button
            type="button"
            onClick={vm.clearError}
            className="ml-2 underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Encryption key warning */}
      {!encryptionEnabled && (
        <div
          className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4"
          data-testid="encryption-warning"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Encryption key required
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Set up your encryption key in Settings before creating or restoring backups.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Legacy migration banner */}
      {vm.legacyBackupCount > 0 && (
        <div
          className="rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 p-4"
          data-testid="legacy-migration-banner"
        >
          <div className="flex items-start gap-3">
            <Database className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {vm.legacyBackupCount} exportable legacy backup{vm.legacyBackupCount > 1 ? "s" : ""} found
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Export your old backups as encrypted archives before they are removed.
              </p>
              <a
                href="/api/backup/migrate"
                className={`inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline ${!encryptionEnabled ? "pointer-events-none opacity-50" : ""}`}
                data-testid="legacy-export-link"
              >
                <Download className="h-3.5 w-3.5" />
                Export All Legacy Backups
              </a>
              {!encryptionEnabled && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Set up your encryption key in Settings first.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create & Download */}
      <div className="rounded-card bg-secondary p-6">
        <div className="flex items-center gap-2 mb-4">
          <Archive className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">Create & Download</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Create an encrypted ZIP archive of all your secrets and download it to your device.
        </p>
        <Button
          size="sm"
          onClick={() => vm.handleDownloadArchive()}
          disabled={vm.busy || !encryptionEnabled}
          data-testid="download-archive-btn"
        >
          <Download className="h-4 w-4 mr-1" />
          Download Encrypted Archive
        </Button>
      </div>

      {/* Push to Backy */}
      <div className="rounded-card bg-secondary p-6">
        <div className="flex items-center gap-2 mb-4">
          <Send className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">Push to Backy</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Encrypt and push your secrets to Backy for off-site storage.
        </p>

        <div className="flex items-center gap-2 mb-4">
          <Button
            size="sm"
            onClick={() => vm.handlePushToBacky()}
            disabled={vm.busy || !encryptionEnabled}
            data-testid="push-backy-btn"
          >
            <Send className="h-4 w-4 mr-1" />
            Push Backup
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => vm.refreshHistory()}
            disabled={vm.busy}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh History
          </Button>
        </div>

        {/* Push result */}
        {vm.lastPushResult && (
          <div
            className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-4 py-3 text-sm"
            data-testid="push-result"
          >
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <Check className="h-4 w-4" />
              <span>{vm.lastPushResult.message}</span>
            </div>
            {vm.lastPushResult.request && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                {vm.lastPushResult.request.secretCount} secrets ·{" "}
                {formatFileSize(vm.lastPushResult.request.fileSizeBytes)} ·{" "}
                {vm.lastPushResult.durationMs}ms
              </p>
            )}
          </div>
        )}

        {/* History */}
        {vm.history && vm.history.recent_backups.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">Recent Backups</h3>
            <div className="space-y-1.5" role="list" aria-label="Backup history">
              {vm.history.recent_backups.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  role="listitem"
                  className="flex items-center justify-between text-xs text-muted-foreground py-1 border-b border-border last:border-0"
                >
                  <span className="truncate">{entry.tag || "Backup"}</span>
                  <span className="shrink-0 ml-2">
                    {formatTimeAgo(new Date(entry.created_at))}
                    {entry.file_size ? ` · ${formatFileSize(entry.file_size)}` : ""}
                  </span>
                </div>
              ))}
            </div>
            {vm.history.total_backups > 5 && (
              <p className="text-xs text-muted-foreground mt-2">
                {vm.history.total_backups} total backups
              </p>
            )}
          </div>
        )}
      </div>

      {/* Restore */}
      <div className="rounded-card bg-secondary p-6">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">Restore from Backup</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Upload an encrypted ZIP archive and enter the encryption key to restore secrets.
        </p>

        <div className="space-y-3">
          {/* Encryption key input */}
          <div className="space-y-2">
            <label htmlFor="restore-key" className="block text-sm font-medium">
              Encryption Key
            </label>
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                id="restore-key"
                type="password"
                value={restoreKey}
                onChange={(e) => setRestoreKey(e.target.value)}
                placeholder="Enter the encryption key used to create the archive"
                disabled={vm.busy}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="restore-key-input"
              />
            </div>
          </div>

          {/* Upload button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={vm.busy || !restoreKey}
            data-testid="restore-upload-btn"
          >
            <Upload className="h-4 w-4 mr-1" />
            Upload & Restore
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleFileRestore}
            data-testid="restore-file-input"
          />

          {/* Restore result */}
          {vm.lastRestoreResult && (
            <div
              className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-4 py-3 text-sm"
              data-testid="restore-result"
            >
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <Check className="h-4 w-4" />
                <span>Restore complete</span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                {vm.lastRestoreResult.imported} imported · {vm.lastRestoreResult.skipped} skipped · {vm.lastRestoreResult.duplicates} duplicates
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
