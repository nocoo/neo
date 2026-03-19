"use client";

/**
 * Settings ViewModel — manages user preferences.
 *
 * Connects to DashboardContext for encryption status and settings server actions.
 */

import { useState, useCallback, useEffect } from "react";
import { useDashboardState } from "@/contexts/dashboard-context";
import {
  getUserSettings as getUserSettingsAction,
  updateUserSettings as updateUserSettingsAction,
} from "@/actions/settings";
import type { UserSettings } from "@/models/types";

// ── Types ────────────────────────────────────────────────────────────────

export interface SettingsViewModelState {
  /** Current user settings. */
  settings: UserSettings | null;
  /** Whether encryption is enabled (from dashboard context). */
  encryptionEnabled: boolean;
  /** Whether settings are loading. */
  loading: boolean;
  /** Whether a save operation is in progress. */
  busy: boolean;
  /** Error message from last operation. */
  error: string | null;
}

export interface SettingsViewModelActions {
  /** Update theme preference. */
  handleUpdateTheme: (theme: string) => Promise<boolean>;
  /** Update language preference. */
  handleUpdateLanguage: (language: string) => Promise<boolean>;
  /** Update encryption key hash. */
  handleUpdateEncryption: (keyHash: string | null) => Promise<boolean>;
  /** Reload settings from server. */
  reload: () => Promise<void>;
  /** Clear error state. */
  clearError: () => void;
}

export type SettingsViewModel = SettingsViewModelState & SettingsViewModelActions;

// ── Hook ─────────────────────────────────────────────────────────────────

export function useSettingsViewModel(): SettingsViewModel {
  const { encryptionEnabled } = useDashboardState();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load settings on mount ────────────────────────────────────────────

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getUserSettingsAction();
      if (result.success) {
        setSettings(result.data);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // ── Update helpers ────────────────────────────────────────────────────

  const updateSettings = useCallback(
    async (input: Parameters<typeof updateUserSettingsAction>[0]): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const result = await updateUserSettingsAction(input);
        if (result.success) {
          setSettings(result.data);
          return true;
        }
        setError(result.error);
        return false;
      } catch {
        setError("Failed to update settings");
        return false;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const handleUpdateTheme = useCallback(
    (theme: string) => updateSettings({ theme }),
    [updateSettings]
  );

  const handleUpdateLanguage = useCallback(
    (language: string) => updateSettings({ language }),
    [updateSettings]
  );

  const handleUpdateEncryption = useCallback(
    (keyHash: string | null) => updateSettings({ encryptionKeyHash: keyHash }),
    [updateSettings]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    settings,
    encryptionEnabled,
    loading,
    busy,
    error,
    handleUpdateTheme,
    handleUpdateLanguage,
    handleUpdateEncryption,
    reload,
    clearError,
  };
}
