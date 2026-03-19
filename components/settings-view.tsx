"use client";

/**
 * SettingsView — user preferences management.
 */

import { Button } from "@/components/ui/button";
import { useSettingsViewModel } from "@/viewmodels/useSettingsViewModel";
import { Shield, Palette, Globe } from "lucide-react";

// ── Component ────────────────────────────────────────────────────────────

export function SettingsView() {
  const vm = useSettingsViewModel();

  if (vm.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

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
            value={vm.settings?.theme ?? "system"}
            onChange={(e) => vm.handleUpdateTheme(e.target.value)}
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
        </div>
      </div>

      {/* Encryption */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">Security</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Backup Encryption</p>
            <p className="text-xs text-muted-foreground">
              {vm.encryptionEnabled
                ? "Your backups are encrypted"
                : "Backups are stored unencrypted"}
            </p>
          </div>
          <span
            className={`text-sm font-medium ${
              vm.encryptionEnabled ? "text-green-600" : "text-muted-foreground"
            }`}
            data-testid="encryption-status"
          >
            {vm.encryptionEnabled ? "Enabled" : "Disabled"}
          </span>
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
