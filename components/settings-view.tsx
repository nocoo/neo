"use client";

/**
 * SettingsView — user preferences, encryption key management, and Backy config.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSettingsViewModel } from "@/viewmodels/useSettingsViewModel";
import {
  Shield,
  Palette,
  Globe,
  Eye,
  EyeOff,
  Copy,
  Check,
  Key,
  Link,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useTheme } from "next-themes";

// ── Component ────────────────────────────────────────────────────────────

export function SettingsView() {
  const vm = useSettingsViewModel();
  const { setTheme, theme: activeTheme } = useTheme();

  // Local state for Backy config form inputs
  const [backyUrl, setBackyUrl] = useState("");
  const [backyApiKey, setBackyApiKey] = useState("");
  const [keyCopied, setKeyCopied] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<"success" | "error" | null>(null);

  // Sync DB-saved theme to next-themes on load / reload.
  // This ensures the theme persists across devices and cleared localStorage.
  const dbTheme = vm.settings?.theme;
  useEffect(() => {
    if (dbTheme && dbTheme !== activeTheme) {
      setTheme(dbTheme);
    }
    // Only run when dbTheme changes (not activeTheme) to avoid infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbTheme, setTheme]);

  // Populate Backy form when config loads
  useEffect(() => {
    if (vm.backyWebhookUrl) setBackyUrl(vm.backyWebhookUrl);
  }, [vm.backyWebhookUrl]);

  if (vm.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  const handleCopyKey = async () => {
    const ok = await vm.handleCopyKey();
    if (ok) {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }
  };

  const handleTestConnection = async () => {
    setConnectionTestResult(null);
    const ok = await vm.handleTestBackyConnection();
    setConnectionTestResult(ok ? "success" : "error");
    setTimeout(() => setConnectionTestResult(null), 3000);
  };

  const handleSaveBackyConfig = async () => {
    await vm.handleSaveBackyConfig(backyUrl, backyApiKey);
    // Clear the raw API key field after save (it's now stored server-side)
    setBackyApiKey("");
  };

  const inputClass =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your preferences and security settings
        </p>
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

      {/* Theme */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">Appearance</h2>
        </div>
        <div className="space-y-2">
          <label htmlFor="theme-select" className="block text-sm font-medium">
            Theme
          </label>
          <select
            id="theme-select"
            value={dbTheme ?? activeTheme ?? "system"}
            onChange={(e) => {
              const newTheme = e.target.value;
              setTheme(newTheme);
              vm.handleUpdateTheme(newTheme);
            }}
            disabled={vm.busy}
            className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>
      </div>

      {/* Language */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">Language</h2>
        </div>
        <div className="space-y-2">
          <label htmlFor="language-select" className="block text-sm font-medium">
            Display Language
          </label>
          <select
            id="language-select"
            value={vm.settings?.language ?? "en"}
            onChange={(e) => vm.handleUpdateLanguage(e.target.value)}
            disabled={vm.busy}
            className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="en">English</option>
            <option value="zh">Chinese</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Multi-language support coming soon. Your preference is saved for future use.
          </p>
        </div>
      </div>

      {/* Encryption Key Management */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">Encryption Key</h2>
        </div>

        {vm.encryptionEnabled && vm.encryptionKey ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span
                className="text-sm font-medium text-green-600"
                data-testid="encryption-status"
              >
                Enabled
              </span>
            </div>

            {/* Key display */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">Your Encryption Key</label>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono break-all"
                  data-testid="encryption-key-display"
                >
                  {vm.keyRevealed ? vm.encryptionKey : "••••••••••••••••••••••••"}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={vm.handleToggleKeyReveal}
                  aria-label={vm.keyRevealed ? "Hide key" : "Reveal key"}
                >
                  {vm.keyRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyKey}
                  aria-label="Copy key"
                >
                  {keyCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Save this key externally. If lost, encrypted backups cannot be restored.
              </p>
            </div>

            {/* Regenerate */}
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={vm.handleGenerateKey}
                disabled={vm.busy}
                data-testid="regenerate-key-btn"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Regenerate Key
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Regenerating will replace the current key. Existing encrypted backups will require the old key to restore.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">No encryption key configured</p>
                <p className="text-xs text-muted-foreground">
                  Generate an encryption key to enable encrypted backups.
                </p>
              </div>
              <span
                className="text-sm font-medium text-muted-foreground"
                data-testid="encryption-status"
              >
                Disabled
              </span>
            </div>
            <Button
              onClick={vm.handleGenerateKey}
              disabled={vm.busy}
              size="sm"
              data-testid="generate-key-btn"
            >
              <Key className="h-4 w-4 mr-1" />
              Generate Encryption Key
            </Button>
          </div>
        )}
      </div>

      {/* Backy Configuration */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Link className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">Backy Integration</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Push encrypted backups to Backy for off-site storage.
        </p>

        <div className="space-y-4">
          {/* Webhook URL */}
          <div className="space-y-2">
            <label htmlFor="backy-url" className="block text-sm font-medium">
              Webhook URL
            </label>
            <input
              id="backy-url"
              type="url"
              value={backyUrl}
              onChange={(e) => setBackyUrl(e.target.value)}
              placeholder="https://backy.example.com/api/webhook/project-id"
              disabled={vm.busy}
              className={inputClass}
            />
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <label htmlFor="backy-api-key" className="block text-sm font-medium">
              API Key
            </label>
            {vm.backyMaskedApiKey && !backyApiKey ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono">
                  {vm.backyMaskedApiKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBackyApiKey("")}
                  aria-label="Change API key"
                >
                  Change
                </Button>
              </div>
            ) : (
              <input
                id="backy-api-key"
                type="password"
                value={backyApiKey}
                onChange={(e) => setBackyApiKey(e.target.value)}
                placeholder="Enter API key"
                disabled={vm.busy}
                className={inputClass}
              />
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSaveBackyConfig}
              disabled={vm.busy || !backyUrl}
              data-testid="save-backy-btn"
            >
              Save Configuration
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={vm.busy || !vm.backyWebhookUrl}
              data-testid="test-connection-btn"
            >
              Test Connection
            </Button>
            {connectionTestResult === "success" && (
              <span className="text-sm text-green-600" data-testid="connection-success">Connected</span>
            )}
            {connectionTestResult === "error" && (
              <span className="text-sm text-destructive" data-testid="connection-error">Failed</span>
            )}
          </div>
        </div>

        {/* Pull Webhook Key */}
        <div className="mt-6 pt-4 border-t border-border">
          <h3 className="text-sm font-medium mb-2">Pull Webhook Key</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Allow Backy to trigger backup creation via pull webhook.
          </p>
          {vm.backyPullKey ? (
            <div className="space-y-2">
              <code
                className="block rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono break-all"
                data-testid="pull-key-display"
              >
                {vm.backyPullKey}
              </code>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={vm.handleGeneratePullWebhook}
                  disabled={vm.busy}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Regenerate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={vm.handleRevokePullWebhook}
                  disabled={vm.busy}
                  data-testid="revoke-pull-key-btn"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Revoke
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={vm.handleGeneratePullWebhook}
              disabled={vm.busy}
              data-testid="generate-pull-key-btn"
            >
              <Key className="h-4 w-4 mr-1" />
              Generate Pull Key
            </Button>
          )}
        </div>
      </div>

      {/* Reload button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => vm.reload()}
          disabled={vm.busy}
        >
          Reload Settings
        </Button>
      </div>
    </div>
  );
}
