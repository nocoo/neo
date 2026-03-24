"use client";

/**
 * DeleteConfirmDialog — confirmation dialog for secret deletion.
 */

import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────

export interface DeleteConfirmDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Name of the secret to delete (for confirmation text). */
  secretName: string;
  /** Close the dialog. */
  onClose: () => void;
  /** Confirm deletion. */
  onConfirm: () => void;
  /** Whether an operation is in progress. */
  busy?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────

export function DeleteConfirmDialog({
  open,
  secretName,
  onClose,
  onConfirm,
  busy = false,
}: DeleteConfirmDialogProps) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm delete"
    >
      <div className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Delete Secret</h2>
            <p className="text-sm text-muted-foreground">The secret will be moved to Recycle Bin.</p>
          </div>
        </div>

        <p className="text-sm mb-6">
          Are you sure you want to delete <strong>{secretName}</strong>?
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
