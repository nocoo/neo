"use client";

/**
 * RecycleBinView — client component for browsing and managing soft-deleted secrets.
 */

import { InputGroup } from "@nocoo/basalt/components/input-group";
import { AlertTriangle, Search, Trash2, Undo2, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { CARD_THEMES, resolveThemeKey } from "@/components/secret-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useHotkey } from "@/hooks/use-hotkey";
import { cn } from "@/lib/utils";
import type { Secret } from "@/models/types";
import { useRecycleBinViewModel } from "@/viewmodels/useRecycleBinViewModel";

// ── Confirm Dialog ────────────────────────────────────────────────────────

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
  busy,
  returnFocusRef,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const triggerFocusRef = useRef<HTMLElement | null>(null);
  return (
    <AlertDialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <AlertDialogContent
        aria-label={title}
        onOpenAutoFocus={() => {
          triggerFocusRef.current =
            returnFocusRef?.current ??
            (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (triggerFocusRef.current?.isConnected) triggerFocusRef.current.focus();
        }}
      >
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-basalt-destructive/10">
              <AlertTriangle className="h-5 w-5 text-basalt-destructive" />
            </div>
            <AlertDialogTitle className="text-lg font-semibold">{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-sm text-basalt-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={busy}
          >
            {busy ? "Processing..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
    <div className="group flex items-center gap-3 rounded-lg border border-basalt-border px-4 py-3 transition-colors hover:bg-basalt-accent/50">
      {/* Color dot */}
      <div className={cn("h-3 w-3 shrink-0 rounded-full", theme.bg)} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-basalt-foreground truncate">{secret.name}</p>
        <p className="text-xs text-basalt-muted-foreground truncate">
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
          className="h-8 w-8 text-basalt-destructive hover:text-basalt-destructive"
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

export function RecycleBinView({ initialSecrets }: { initialSecrets: Secret[] }) {
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
        <InputGroup className="min-w-0 flex-1">
          <InputGroup.Addon align="start">
            <Search className="h-4 w-4" />
          </InputGroup.Addon>
          <InputGroup.Input
            ref={searchRef}
            type="text"
            placeholder="Search deleted secrets..."
            value={vm.searchQuery}
            onChange={(e) => vm.setSearchQuery(e.target.value)}
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
          className="rounded-lg bg-basalt-destructive/10 px-4 py-3 text-sm text-basalt-destructive"
          role="alert"
        >
          {vm.error}
          <Button variant="link" size="sm" onClick={vm.clearError} className="ml-2 cursor-pointer">
            Dismiss
          </Button>
        </div>
      )}

      {/* Loading */}
      {vm.loading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-basalt-muted-foreground">Loading...</p>
        </div>
      )}

      {/* Deleted secrets list */}
      {!vm.loading && vm.filteredSecrets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Trash2 className="h-10 w-10 text-basalt-muted-foreground/30 mb-3" />
          <p className="text-sm text-basalt-muted-foreground">
            {vm.searchQuery ? "No deleted secrets match your search." : "Recycle bin is empty."}
          </p>
        </div>
      ) : (
        !vm.loading && (
          <ul className="flex flex-col gap-2" aria-label="Deleted secrets list">
            {vm.filteredSecrets.map((secret) => (
              <li key={secret.id}>
                <DeletedSecretRow
                  secret={secret}
                  onRestore={vm.handleRestore}
                  onPermanentDelete={(id) => setConfirmDeleteId(id)}
                  busy={vm.busy}
                />
              </li>
            ))}
          </ul>
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
