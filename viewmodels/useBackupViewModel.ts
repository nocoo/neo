"use client";

/**
 * Backup ViewModel — manages encrypted archive download, Backy push, and restore.
 *
 * New flow:
 *   1. "Create & Download" → GET /api/backup/archive → browser download
 *   2. "Push to Backy" → pushBackupToBacky() server action
 *   3. "Restore" → POST /api/backup/restore (multipart: ZIP + encryption key)
 *
 * Old D1 backup list, manual backup creation, and cleanup are removed.
 */

import { useState, useCallback, useEffect } from "react";
import { useDashboardActions, useDashboardState } from "@/contexts/dashboard-context";
import {
  pushBackupToBacky as pushToBackyAction,
  fetchBackyHistory as fetchHistoryAction,
} from "@/actions/backy";
import type { BackyPushDetail, BackyHistoryResponse } from "@/models/backy";

// ── Types ────────────────────────────────────────────────────────────────

export interface BackupViewModelState {
  /** Whether an operation is in progress. */
  busy: boolean;
  /** Error message from last operation. */
  error: string | null;
  /** Last push result (shown in UI). */
  lastPushResult: BackyPushDetail | null;
  /** Backy backup history. */
  history: BackyHistoryResponse | null;
  /** Restore result from last restore operation. */
  lastRestoreResult: { imported: number; skipped: number; duplicates: number } | null;
}

export interface BackupViewModelActions {
  /** Trigger encrypted archive download via route handler. */
  handleDownloadArchive: () => Promise<void>;
  /** Push encrypted backup to Backy. */
  handlePushToBacky: () => Promise<boolean>;
  /** Restore from an uploaded ZIP file + encryption key. */
  handleRestore: (file: File, encryptionKey: string) => Promise<boolean>;
  /** Refresh Backy history. */
  refreshHistory: () => Promise<void>;
  /** Clear error state. */
  clearError: () => void;
}

export type BackupViewModel = BackupViewModelState & BackupViewModelActions;

// ── Hook ─────────────────────────────────────────────────────────────────

export function useBackupViewModel(): BackupViewModel {
  const { refresh } = useDashboardActions();
  const { encryptionEnabled } = useDashboardState();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPushResult, setLastPushResult] = useState<BackyPushDetail | null>(null);
  const [history, setHistory] = useState<BackyHistoryResponse | null>(null);
  const [lastRestoreResult, setLastRestoreResult] = useState<{
    imported: number;
    skipped: number;
    duplicates: number;
  } | null>(null);

  // ── Load history on mount ────────────────────────────────────────────

  const refreshHistory = useCallback(async () => {
    try {
      const result = await fetchHistoryAction();
      if (result.success) {
        setHistory(result.data);
      }
    } catch {
      // Non-critical — history may not be available if Backy not configured
    }
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // ── Download encrypted archive ────────────────────────────────────────

  const handleDownloadArchive = useCallback(async () => {
    if (!encryptionEnabled) {
      setError("Set up your encryption key in Settings before creating backups.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/backup/archive");

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Download failed" }));
        setError(data.error || `Download failed (${res.status})`);
        return;
      }

      // Trigger browser download
      const blob = await res.blob();
      const filename =
        res.headers.get("Content-Disposition")?.match(/filename="?(.+?)"?$/)?.[1] ??
        "neo-backup.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download backup archive");
    } finally {
      setBusy(false);
    }
  }, [encryptionEnabled]);

  // ── Push to Backy ──────────────────────────────────────────────────────

  const handlePushToBacky = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    setLastPushResult(null);
    try {
      const result = await pushToBackyAction();
      if (result.success) {
        setLastPushResult(result.data);
        // Update history inline from push result
        if (result.data.history) {
          setHistory(result.data.history);
        }
        return true;
      }
      setError(result.error);
      return false;
    } catch {
      setError("Failed to push backup to Backy");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  // ── Restore from ZIP ──────────────────────────────────────────────────

  const handleRestore = useCallback(
    async (file: File, encryptionKey: string): Promise<boolean> => {
      setBusy(true);
      setError(null);
      setLastRestoreResult(null);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("encryptionKey", encryptionKey);

        const res = await fetch("/api/backup/restore", {
          method: "POST",
          body: form,
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || `Restore failed (${res.status})`);
          return false;
        }

        setLastRestoreResult({
          imported: data.imported,
          skipped: data.skipped,
          duplicates: data.duplicates,
        });

        // Refresh dashboard so restored secrets appear
        await refresh();
        return true;
      } catch {
        setError("Failed to restore backup");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    busy,
    error,
    lastPushResult,
    history,
    lastRestoreResult,
    handleDownloadArchive,
    handlePushToBacky,
    handleRestore,
    refreshHistory,
    clearError,
  };
}
