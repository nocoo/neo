"use client";

/**
 * SecretsView — client component that wires up the secrets ViewModel
 * with all the presentation components.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Plus, Upload, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SecretList } from "@/components/secret-list";
import { SecretFormDialog } from "@/components/secret-form-dialog";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { ImportDialog } from "@/components/import-dialog";
import { ExportDialog } from "@/components/export-dialog";
import { useSecretsViewModel } from "@/viewmodels/useSecretsViewModel";
import { useDevToolsViewModel } from "@/viewmodels/useDevToolsViewModel";
import { useHotkey } from "@/hooks/use-hotkey";
import type { Secret } from "@/models/types";

// ── Component ────────────────────────────────────────────────────────────

export function SecretsView() {
  const vm = useSecretsViewModel();
  const devTools = useDevToolsViewModel();

  // Search input ref for Cmd+K focus
  const searchRef = useRef<HTMLInputElement>(null);
  useHotkey("k", () => searchRef.current?.focus());

  // Dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [deletingSecret, setDeletingSecret] = useState<Secret | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Keyboard navigation state
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Reset selection when search query changes
  useEffect(() => {
    setSelectedIndex(null);
  }, [vm.searchQuery]);

  const handleFocusSearch = useCallback(() => {
    searchRef.current?.focus();
  }, []);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (vm.filteredSecrets.length > 0) {
          setSelectedIndex(0);
          searchRef.current?.blur();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        vm.setSearchQuery("");
        searchRef.current?.blur();
      }
    },
    [vm],
  );

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleEdit = useCallback((secret: Secret) => {
    setEditingSecret(secret);
  }, []);

  const handleDeleteRequest = useCallback(
    (id: string) => {
      const secret = vm.filteredSecrets.find((s) => s.id === id);
      if (secret) setDeletingSecret(secret);
    },
    [vm.filteredSecrets]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingSecret) return;
    const success = await vm.handleDelete(deletingSecret.id);
    if (success) setDeletingSecret(null);
  }, [deletingSecret, vm]);

  return (
    <div className="space-y-6">
      {/* Search + actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search secrets..."
            value={vm.searchQuery}
            onChange={(e) => vm.setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Search secrets"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-input bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </div>
        <Button variant="outline" size="icon" onClick={() => setShowImport(true)} title="Import">
          <Upload className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setShowExport(true)} title="Export">
          <Download className="h-4 w-4" />
        </Button>
        <Button size="icon" onClick={() => setShowCreate(true)} title="Add secret">
          <Plus className="h-4 w-4" />
        </Button>
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

      {/* Secret list */}
      <SecretList
        secrets={vm.filteredSecrets}
        otpMap={vm.otpMap}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
        selectedIndex={selectedIndex}
        onSelectedIndexChange={setSelectedIndex}
        onFocusSearch={handleFocusSearch}
      />

      {/* Dialogs */}
      <SecretFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={vm.handleCreate}
        busy={vm.busy}
      />

      <SecretFormDialog
        open={!!editingSecret}
        {...(editingSecret ? { secret: editingSecret } : {})}
        onClose={() => setEditingSecret(null)}
        onUpdate={vm.handleUpdate}
        busy={vm.busy}
      />

      <DeleteConfirmDialog
        open={!!deletingSecret}
        secretName={deletingSecret?.name ?? ""}
        onClose={() => setDeletingSecret(null)}
        onConfirm={handleDeleteConfirm}
        busy={vm.busy}
      />

      <ImportDialog
        open={showImport}
        onClose={() => {
          setShowImport(false);
          devTools.clearParsed();
        }}
        onParse={devTools.handleParseImport}
        onImport={vm.handleBatchImport}
        parsedSecrets={devTools.parsedSecrets}
        detectedFormat={devTools.detectedFormat}
        error={devTools.error}
        busy={vm.busy}
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
