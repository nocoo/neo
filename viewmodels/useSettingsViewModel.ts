"use client";

/**
 * Settings ViewModel — manages user preferences, encryption key, and Backy config.
 *
 * Connects to DashboardContext for encryption status and settings server actions.
 */

import { useState, useCallback, useEffect } from "react";
import { useDashboardState, useDashboardActions } from "@/contexts/dashboard-context";
import {
  getUserSettings as getUserSettingsAction,
  updateUserSettings as updateUserSettingsAction,
  getEncryptionKey as getEncryptionKeyAction,
  generateAndSaveEncryptionKey as generateKeyAction,
} from "@/actions/settings";
import {
  getBackyConfig as getBackyConfigAction,
  saveBackyConfig as saveBackyConfigAction,
  testBackyConnection as testConnectionAction,
  getBackyPullWebhook as getPullWebhookAction,
  generateBackyPullWebhook as generatePullWebhookAction,
  revokeBackyPullWebhook as revokePullWebhookAction,
} from "@/actions/backy";
import type { UserSettings } from "@/models/types";

// ── Types ────────────────────────────────────────────────────────────────

export interface SettingsViewModelState {
  /** Current user settings. */
  settings: UserSettings | null;
  /** Whether encryption is enabled (from dashboard context). */
  encryptionEnabled: boolean;
  /** The actual encryption key (loaded on demand). */
  encryptionKey: string | null;
  /** Whether the encryption key is revealed in the UI. */
  keyRevealed: boolean;
  /** Backy webhook URL (for display). */
  backyWebhookUrl: string | null;
  /** Backy API key (masked for display). */
  backyMaskedApiKey: string | null;
  /** Backy pull webhook key. */
  backyPullKey: string | null;
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
  /** Generate a new encryption key. */
  handleGenerateKey: () => Promise<boolean>;
  /** Toggle encryption key visibility. */
  handleToggleKeyReveal: () => void;
  /** Copy encryption key to clipboard. */
  handleCopyKey: () => Promise<boolean>;
  /** Save Backy config. */
  handleSaveBackyConfig: (webhookUrl: string, apiKey: string) => Promise<boolean>;
  /** Test Backy connection. */
  handleTestBackyConnection: () => Promise<boolean>;
  /** Generate Backy pull webhook key. */
  handleGeneratePullWebhook: () => Promise<boolean>;
  /** Revoke Backy pull webhook key. */
  handleRevokePullWebhook: () => Promise<boolean>;
  /** Reload settings from server. */
  reload: () => Promise<void>;
  /** Clear error state. */
  clearError: () => void;
}

export type SettingsViewModel = SettingsViewModelState & SettingsViewModelActions;

// ── Hook ─────────────────────────────────────────────────────────────────

export function useSettingsViewModel(): SettingsViewModel {
  const { encryptionEnabled } = useDashboardState();
  const { refresh } = useDashboardActions();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [backyWebhookUrl, setBackyWebhookUrl] = useState<string | null>(null);
  const [backyMaskedApiKey, setBackyMaskedApiKey] = useState<string | null>(null);
  const [backyPullKey, setBackyPullKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load all settings on mount ──────────────────────────────────────────

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsResult, keyResult, backyResult, pullResult] = await Promise.all([
        getUserSettingsAction(),
        getEncryptionKeyAction(),
        getBackyConfigAction(),
        getPullWebhookAction(),
      ]);

      if (settingsResult.success) setSettings(settingsResult.data);
      if (keyResult.success) setEncryptionKey(keyResult.data);
      if (backyResult.success && backyResult.data) {
        setBackyWebhookUrl(backyResult.data.webhookUrl);
        setBackyMaskedApiKey(backyResult.data.maskedApiKey);
      }
      if (pullResult.success) setBackyPullKey(pullResult.data);
    } catch {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // ── Update helpers ──────────────────────────────────────────────────────

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

  // ── Encryption key management ───────────────────────────────────────────

  const handleGenerateKey = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const result = await generateKeyAction();
      if (result.success) {
        setEncryptionKey(result.data);
        setKeyRevealed(true);
        // Refresh dashboard to update encryptionEnabled
        await refresh();
        return true;
      }
      setError(result.error);
      return false;
    } catch {
      setError("Failed to generate encryption key");
      return false;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const handleToggleKeyReveal = useCallback(() => {
    setKeyRevealed((prev) => !prev);
  }, []);

  const handleCopyKey = useCallback(async (): Promise<boolean> => {
    if (!encryptionKey) return false;
    try {
      await navigator.clipboard.writeText(encryptionKey);
      return true;
    } catch {
      return false;
    }
  }, [encryptionKey]);

  // ── Backy config ────────────────────────────────────────────────────────

  const handleSaveBackyConfig = useCallback(
    async (webhookUrl: string, apiKey: string): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const result = await saveBackyConfigAction({ webhookUrl, apiKey });
        if (result.success) {
          setBackyWebhookUrl(result.data.webhookUrl);
          setBackyMaskedApiKey(result.data.maskedApiKey);
          return true;
        }
        setError(result.error);
        return false;
      } catch {
        setError("Failed to save Backy config");
        return false;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const handleTestBackyConnection = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const result = await testConnectionAction();
      if (result.success) return true;
      setError(result.error);
      return false;
    } catch {
      setError("Connection test failed");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const handleGeneratePullWebhook = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const result = await generatePullWebhookAction();
      if (result.success) {
        setBackyPullKey(result.data);
        return true;
      }
      setError(result.error);
      return false;
    } catch {
      setError("Failed to generate pull webhook");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const handleRevokePullWebhook = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const result = await revokePullWebhookAction();
      if (result.success) {
        setBackyPullKey(null);
        return true;
      }
      setError(result.error);
      return false;
    } catch {
      setError("Failed to revoke pull webhook");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    settings,
    encryptionEnabled,
    encryptionKey,
    keyRevealed,
    backyWebhookUrl,
    backyMaskedApiKey,
    backyPullKey,
    loading,
    busy,
    error,
    handleUpdateTheme,
    handleUpdateLanguage,
    handleGenerateKey,
    handleToggleKeyReveal,
    handleCopyKey,
    handleSaveBackyConfig,
    handleTestBackyConnection,
    handleGeneratePullWebhook,
    handleRevokePullWebhook,
    reload,
    clearError,
  };
}
