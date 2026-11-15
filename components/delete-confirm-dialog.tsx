"use client";

/**
 * DeleteConfirmDialog — confirmation dialog for secret deletion.
 */

import { AlertTriangle } from "lucide-react";
import { useRef } from "react";
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
  /** Optional element that should regain focus after the dialog closes. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
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
  returnFocusRef,
}: DeleteConfirmDialogProps) {
  const triggerFocusRef = useRef<HTMLElement | null>(null);
  return (
    <AlertDialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <AlertDialogContent
        aria-label="Confirm delete"
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
            <AlertDialogTitle className="text-lg font-semibold">Delete Secret</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-sm text-basalt-muted-foreground">
            The secret will be moved to Recycle Bin.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <p className="text-sm mb-6">
          Are you sure you want to delete <strong>{secretName}</strong>?
        </p>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={busy}
          >
            {busy ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
