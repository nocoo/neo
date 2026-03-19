"use client";

/**
 * BackupView — client component for backup management.
 */

import { useEffect, useCallback, useRef } from "react";
import { Archive, Download, Trash2, RefreshCw, Upload, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBackupViewModel } from "@/viewmodels/useBackupViewModel";
import { useDashboardState } from "@/contexts/dashboard-context";
import type { Backup } from "@/models/types";

/**
 * Trigger a JSON file download in the browser.
 */
function downloadBackup(backup: Backup): void {
  const blob = new Blob([backup.data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backup.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Component ────────────────────────────────────────────────────────────

export function BackupView() {
  const vm = useBackupViewModel();
  const { secrets } = useDashboardState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load backups on mount
  useEffect(() => {
    vm.loadBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateBackup = useCallback(async () => {
    const secretsJson = JSON.stringify(
      secrets.map((s) => ({
        id: s.id,
        name: s.name,
        account: s.account,
        secret: s.secret,
        type: s.type,
        digits: s.digits,
        period: s.period,
        algorithm: s.algorithm,
        counter: s.counter,
      }))
    );
    await vm.handleCreateBackup(secretsJson);
  }, [secrets, vm]);

  // Restore from an existing backup in the list
  const handleRestoreFromBackup = useCallback(
    async (backup: Backup) => {
      await vm.handleRestore(backup.data);
    },
    [vm]
  );

  // Upload and restore from a JSON file
  const handleFileRestore = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        await vm.handleRestore(text);
      } catch {
        // Error will be set in vm
      }

      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [vm]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Backups</h1>
          <p className="text-sm text-muted-foreground">
            {vm.backupCount} backup{vm.backupCount !== 1 ? "s" : ""} total
            {vm.lastBackupAt && (
              <> &middot; Last: {vm.lastBackupAt.toLocaleDateString()}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={vm.busy}
          >
            <Upload className="h-4 w-4 mr-1" />
            Upload Restore
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileRestore}
            data-testid="restore-file-input"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => vm.handleCleanup()}
            disabled={vm.busy}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Cleanup
          </Button>
          <Button size="sm" onClick={handleCreateBackup} disabled={vm.busy}>
            <Archive className="h-4 w-4 mr-1" />
            Create Backup
          </Button>
        </div>
      </div>

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

      {/* Backup list */}
      {vm.backups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Archive className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-sm text-muted-foreground">
            No backups yet. Create your first backup to protect your secrets.
          </p>
        </div>
      ) : (
        <div className="space-y-2" role="list" aria-label="Backups list">
          {vm.backups.map((backup) => (
            <div
              key={backup.id}
              role="listitem"
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{backup.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {backup.secretCount} secret{backup.secretCount !== 1 ? "s" : ""}
                  {" · "}
                  {backup.reason}
                  {backup.encrypted && " · Encrypted"}
                  {" · "}
                  {backup.createdAt.toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Restore ${backup.filename}`} onClick={() => handleRestoreFromBackup(backup)} disabled={vm.busy}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Download ${backup.filename}`} onClick={() => downloadBackup(backup)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Refresh */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => vm.loadBackups()}
          disabled={vm.busy}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
