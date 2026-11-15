"use client";

/**
 * SecretsView — client component that wires up the secrets ViewModel
 * with all the presentation components.
 */

import { InputGroup } from "@nocoo/basalt/components/input-group";
import { Download, Plus, Search, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { ExportDialog } from "@/components/export-dialog";
import { ImportDialog } from "@/components/import-dialog";
import { SecretFormDialog } from "@/components/secret-form-dialog";
import { SecretList } from "@/components/secret-list";
import { Button } from "@/components/ui/button";
import { useHotkey } from "@/hooks/use-hotkey";
import type { Secret } from "@/models/types";
import { useDevToolsViewModel } from "@/viewmodels/useDevToolsViewModel";
import { useSecretsViewModel } from "@/viewmodels/useSecretsViewModel";

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
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const importTriggerRef = useRef<HTMLButtonElement>(null);
  const exportTriggerRef = useRef<HTMLButtonElement>(null);
  const editTriggerRef = useRef<HTMLElement | null>(null);

  // Keyboard navigation state
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Reset selection when search query changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — the dep triggers the reset; the body doesn't read it.
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
    editTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingSecret(secret);
  }, []);

  const handleDeleteRequest = useCallback(
    (id: string) => {
      const secret = vm.filteredSecrets.find((s) => s.id === id);
      if (secret) setDeletingSecret(secret);
    },
    [vm.filteredSecrets],
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
        <InputGroup className="min-w-0 flex-1">
          <InputGroup.Addon align="start">
            <Search className="h-4 w-4" />
          </InputGroup.Addon>
          <InputGroup.Input
            ref={searchRef}
            type="text"
            placeholder="Search secrets..."
            value={vm.searchQuery}
            onChange={(e) => vm.setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search secrets"
          />
          <InputGroup.Addon align="end">
            {vm.searchQuery && (
              <InputGroup.Button aria-label="Clear search" onClick={() => vm.setSearchQuery("")}>
                <X className="h-4 w-4" />
              </InputGroup.Button>
            )}
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-basalt-border bg-basalt-muted px-1.5 text-[10px] font-medium text-basalt-muted-foreground">
              ⌘K
            </kbd>
          </InputGroup.Addon>
        </InputGroup>
        <Button
          ref={importTriggerRef}
          variant="outline"
          size="icon"
          onClick={() => setShowImport(true)}
          title="Import"
        >
          <Upload className="h-4 w-4" />
        </Button>
        <Button
          ref={exportTriggerRef}
          variant="outline"
          size="icon"
          onClick={() => setShowExport(true)}
          title="Export"
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          ref={createTriggerRef}
          size="icon"
          onClick={() => setShowCreate(true)}
          title="Add secret"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Error banner */}
      {vm.error && (
        <div
          className="rounded-lg bg-basalt-destructive/10 px-4 py-3 text-sm text-basalt-destructive"
          role="alert"
        >
          {vm.error}
          <Button variant="link" size="sm" onClick={vm.clearError} className="ml-2 cursor-pointer">
            Dismiss
          </Button>
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
        returnFocusRef={createTriggerRef}
      />

      <SecretFormDialog
        open={!!editingSecret}
        {...(editingSecret ? { secret: editingSecret } : {})}
        onClose={() => setEditingSecret(null)}
        onUpdate={vm.handleUpdate}
        busy={vm.busy}
        returnFocusRef={editTriggerRef}
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
        returnFocusRef={importTriggerRef}
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
        returnFocusRef={exportTriggerRef}
      />
    </div>
  );
}
