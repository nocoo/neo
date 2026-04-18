"use client";

/**
 * RecycleBinView — client component for browsing and managing soft-deleted secrets.
 */

import { useState, useCallback, useRef } from "react";
import { Search, Undo2, Trash2, AlertTriangle } from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useRecycleBinViewModel } from "@/viewmodels/useRecycleBinViewModel";
import { useHotkey } from "@/hooks/use-hotkey";
import { cn } from "@/lib/utils";
import { resolveThemeKey, CARD_THEMES } from "@/components/secret-card";
import type { Secret } from "@/models/types";

// ── Confirm Dialog ────────────────────────────────────────────────────────

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? "Processing..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Deleted Secret Row ────────────────────────────────────────────────────

function DeletedSecretRow({
  secret,
  onRestore,
  onPermanentDelete,
  busy,
}: {
  secret: Secret;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  busy: boolean;
}) {
  const themeKey = resolveThemeKey(secret);
  const theme = CARD_THEMES.find((t) => t.key === themeKey) ?? CARD_THEMES[0];

  const deletedDate = secret.deletedAt
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(secret.deletedAt)
    : "—";

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-accent/50">
      {/* Color dot */}
      <div className={cn("h-3 w-3 shrink-0 rounded-full", theme.bg)} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {secret.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {secret.account ? `${secret.account} · ` : ""}
          Deleted {deletedDate}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onRestore(secret.id)}
          disabled={busy}
          title="Restore"
          aria-label={`Restore ${secret.name}`}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onPermanentDelete(secret.id)}
          disabled={busy}
          title="Permanently delete"
          aria-label={`Permanently delete ${secret.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export function RecycleBinView({
  initialSecrets,
}: {
  initialSecrets: Secret[];
}) {
  const vm = useRecycleBinViewModel(initialSecrets);

  // Search input ref for Cmd+K focus
  const searchRef = useRef<HTMLInputElement>(null);
  useHotkey("k", () => searchRef.current?.focus());

  // Confirm dialogs state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  const handlePermanentDeleteConfirm = useCallback(async () => {
    if (!confirmDeleteId) return;
    const success = await vm.handlePermanentDelete(confirmDeleteId);
    if (success) setConfirmDeleteId(null);
  }, [confirmDeleteId, vm]);

  const handleEmptyBinConfirm = useCallback(async () => {
    const success = await vm.handleEmptyBin();
    if (success) setShowEmptyConfirm(false);
  }, [vm]);

  return (
    <div className="space-y-6">
      {/* Search + actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search deleted secrets..."
            value={vm.searchQuery}
            onChange={(e) => vm.setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-secondary py-2 pl-10 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Search secrets"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </div>
        {vm.deletedSecrets.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowEmptyConfirm(true)}
            disabled={vm.busy}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Empty Bin
          </Button>
        )}
      </div>

      {/* Error banner */}
      {vm.error && (
        <div
          className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
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

      {/* Loading */}
      {vm.loading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      )}

      {/* Deleted secrets list */}
      {!vm.loading && vm.filteredSecrets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Trash2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {vm.searchQuery
              ? "No deleted secrets match your search."
              : "Recycle bin is empty."}
          </p>
        </div>
      ) : (
        !vm.loading && (
          <div className="flex flex-col gap-2" role="list" aria-label="Deleted secrets list">
            {vm.filteredSecrets.map((secret) => (
              <div key={secret.id} role="listitem">
                <DeletedSecretRow
                  secret={secret}
                  onRestore={vm.handleRestore}
                  onPermanentDelete={(id) => setConfirmDeleteId(id)}
                  busy={vm.busy}
                />
              </div>
            ))}
          </div>
        )
      )}

      {/* Permanent delete confirm dialog */}
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Permanently Delete"
        description="This action cannot be undone."
        confirmLabel="Delete Forever"
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handlePermanentDeleteConfirm}
        busy={vm.busy}
      />

      {/* Empty bin confirm dialog */}
      <ConfirmDialog
        open={showEmptyConfirm}
        title="Empty Recycle Bin"
        description={`Permanently delete all ${vm.deletedSecrets.length} item(s)? This cannot be undone.`}
        confirmLabel="Empty Bin"
        onClose={() => setShowEmptyConfirm(false)}
        onConfirm={handleEmptyBinConfirm}
        busy={vm.busy}
      />
    </div>
  );
}
