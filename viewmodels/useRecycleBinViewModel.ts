"use client";

/**
 * Recycle Bin ViewModel — manages search, restore, and permanent-delete operations
 * for soft-deleted secrets.
 */

import { useState, useCallback, useMemo } from "react";
import {
  getDeletedSecrets as getDeletedSecretsAction,
  restoreSecret as restoreSecretAction,
  permanentDeleteSecret as permanentDeleteSecretAction,
  emptyRecycleBin as emptyRecycleBinAction,
} from "@/actions/secrets";
import type { Secret } from "@/models/types";

// ── Types ────────────────────────────────────────────────────────────────

export interface RecycleBinViewModel {
  /** Filtered deleted secrets based on search query. */
  filteredSecrets: Secret[];
  /** All deleted secrets. */
  deletedSecrets: Secret[];
  /** Search query string. */
  searchQuery: string;
  /** Whether data is loading. */
  loading: boolean;
  /** Whether an operation is in progress. */
  busy: boolean;
  /** Error message from last operation. */
  error: string | null;

  setSearchQuery: (query: string) => void;
  handleRestore: (id: string) => Promise<boolean>;
  handlePermanentDelete: (id: string) => Promise<boolean>;
  handleEmptyBin: () => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useRecycleBinViewModel(
  initialSecrets: Secret[] = [],
): RecycleBinViewModel {
  const [deletedSecrets, setDeletedSecrets] = useState<Secret[]>(initialSecrets);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Filtered secrets ──────────────────────────────────────────────────

  const filteredSecrets = useMemo(() => {
    const sorted = [...deletedSecrets].sort((a, b) => {
      // Sort by deleted_at desc (most recently deleted first)
      const aTime = a.deletedAt?.getTime() ?? 0;
      const bTime = b.deletedAt?.getTime() ?? 0;
      return bTime - aTime;
    });
    if (!searchQuery.trim()) return sorted;
    const query = searchQuery.toLowerCase();
    return sorted.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        (s.account && s.account.toLowerCase().includes(query)),
    );
  }, [deletedSecrets, searchQuery]);

  // ── Actions ────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDeletedSecretsAction();
      if (result.success) {
        setDeletedSecrets(result.data);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to load deleted secrets");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRestore = useCallback(async (id: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const result = await restoreSecretAction(id);
      if (result.success) {
        setDeletedSecrets((prev) => prev.filter((s) => s.id !== id));
        return true;
      }
      setError(result.error);
      return false;
    } catch {
      setError("Failed to restore secret");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const handlePermanentDelete = useCallback(async (id: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const result = await permanentDeleteSecretAction(id);
      if (result.success) {
        setDeletedSecrets((prev) => prev.filter((s) => s.id !== id));
        return true;
      }
      setError(result.error);
      return false;
    } catch {
      setError("Failed to permanently delete secret");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const handleEmptyBin = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const result = await emptyRecycleBinAction();
      if (result.success) {
        setDeletedSecrets([]);
        return true;
      }
      setError(result.error);
      return false;
    } catch {
      setError("Failed to empty recycle bin");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    filteredSecrets,
    deletedSecrets,
    searchQuery,
    loading,
    busy,
    error,
    setSearchQuery,
    handleRestore,
    handlePermanentDelete,
    handleEmptyBin,
    refresh,
    clearError,
  };
}
