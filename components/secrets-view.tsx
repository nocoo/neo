"use client";

/**
 * SecretsView — client component that wires up the secrets ViewModel
 * with all the presentation components.
 */

import { useState, useCallback } from "react";
import { Plus, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SecretList } from "@/components/secret-list";
import { SecretFormDialog } from "@/components/secret-form-dialog";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { ImportDialog } from "@/components/import-dialog";
import { ExportDialog } from "@/components/export-dialog";
import { useSecretsViewModel } from "@/viewmodels/useSecretsViewModel";
import { useDevToolsViewModel } from "@/viewmodels/useDevToolsViewModel";
import type { Secret } from "@/models/types";

// ── Component ────────────────────────────────────────────────────────────

export function SecretsView() {
  const vm = useSecretsViewModel();
  const devTools = useDevToolsViewModel();

  // Dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [deletingSecret, setDeletingSecret] = useState<Secret | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Secrets</h1>
          <p className="text-sm text-muted-foreground">
            Manage your 2FA secrets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowExport(true)}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Secret
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

      {/* Secret list */}
      <SecretList
        secrets={vm.filteredSecrets}
        otpMap={vm.otpMap}
        searchQuery={vm.searchQuery}
        onSearchChange={vm.setSearchQuery}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
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
        secret={editingSecret ?? undefined}
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
