"use client";

/**
 * SecretFormDialog — shared form for creating and editing secrets.
 */

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Secret, CreateSecretInput, UpdateSecretInput } from "@/models/types";

// ── Types ────────────────────────────────────────────────────────────────

export interface SecretFormDialogProps {
  /** If provided, edit mode; otherwise, create mode. */
  secret?: Secret;
  /** Whether the dialog is open. */
  open: boolean;
  /** Close the dialog. */
  onClose: () => void;
  /** Create handler (create mode). */
  onCreate?: (input: CreateSecretInput) => Promise<boolean>;
  /** Update handler (edit mode). */
  onUpdate?: (input: UpdateSecretInput) => Promise<boolean>;
  /** Whether an operation is in progress. */
  busy?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────

export function SecretFormDialog({
  secret,
  open,
  onClose,
  onCreate,
  onUpdate,
  busy = false,
}: SecretFormDialogProps) {
  const isEdit = !!secret;

  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Sync form when opening in edit mode
  useEffect(() => {
    if (open && secret) {
      setName(secret.name);
      setAccount(secret.account || "");
      setSecretValue(secret.secret);
      setFormError(null);
    } else if (open) {
      setName("");
      setAccount("");
      setSecretValue("");
      setFormError(null);
    }
  }, [open, secret]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);

      if (!name.trim()) {
        setFormError("Name is required");
        return;
      }

      if (!isEdit && !secretValue.trim()) {
        setFormError("Secret key is required");
        return;
      }

      if (isEdit && secret && onUpdate) {
        const input: UpdateSecretInput = { id: secret.id, name: name.trim() };
        if (account.trim()) input.account = account.trim();
        const success = await onUpdate(input);
        if (success) onClose();
      } else if (onCreate) {
        const input: CreateSecretInput = {
          name: name.trim(),
          secret: secretValue.trim(),
        };
        if (account.trim()) input.account = account.trim();
        const success = await onCreate(input);
        if (success) onClose();
      }
    },
    [name, account, secretValue, isEdit, secret, onCreate, onUpdate, onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Edit secret" : "Create secret"}
    >
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {isEdit ? "Edit Secret" : "Add Secret"}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="secret-name" className="block text-sm font-medium mb-1">
              Name *
            </label>
            <input
              id="secret-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., GitHub"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="secret-account" className="block text-sm font-medium mb-1">
              Account
            </label>
            <input
              id="secret-account"
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="e.g., user@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {!isEdit && (
            <div>
              <label htmlFor="secret-key" className="block text-sm font-medium mb-1">
                Secret Key *
              </label>
              <input
                id="secret-key"
                type="text"
                value={secretValue}
                onChange={(e) => setSecretValue(e.target.value)}
                placeholder="Base32 encoded key"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
          )}

          {formError && (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
