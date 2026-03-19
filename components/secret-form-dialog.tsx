"use client";

/**
 * SecretFormDialog — shared form for creating and editing secrets.
 * Includes a color picker for assigning card colors.
 */

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardThemeKey } from "@/components/secret-card";
import type { Secret, CreateSecretInput, UpdateSecretInput } from "@/models/types";

// ── Color options (skip "default" — it means auto) ───────────────────────

const COLOR_OPTIONS: { key: CardThemeKey | ""; label: string; swatch: string }[] = [
  { key: "",         label: "Auto",    swatch: "bg-gradient-to-br from-gray-300 to-gray-500" },
  { key: "red",      label: "Red",     swatch: "bg-red-500" },
  { key: "emerald",  label: "Emerald", swatch: "bg-emerald-600" },
  { key: "zinc",     label: "Zinc",    swatch: "bg-zinc-800" },
  { key: "blue",     label: "Blue",    swatch: "bg-blue-500" },
  { key: "purple",   label: "Purple",  swatch: "bg-purple-500" },
  { key: "amber",    label: "Amber",   swatch: "bg-amber-500" },
  { key: "cyan",     label: "Cyan",    swatch: "bg-cyan-600" },
  { key: "pink",     label: "Pink",    swatch: "bg-pink-500" },
  { key: "indigo",   label: "Indigo",  swatch: "bg-indigo-500" },
  { key: "teal",     label: "Teal",    swatch: "bg-teal-600" },
  { key: "orange",   label: "Orange",  swatch: "bg-orange-500" },
];

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
  const [color, setColor] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  // Sync form when opening in edit mode
  useEffect(() => {
    if (open && secret) {
      setName(secret.name);
      setAccount(secret.account || "");
      setSecretValue(secret.secret);
      setColor(secret.color || "");
      setFormError(null);
    } else if (open) {
      setName("");
      setAccount("");
      setSecretValue("");
      setColor("");
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
        if (color !== undefined) input.color = color || undefined;
        const success = await onUpdate(input);
        if (success) onClose();
      } else if (onCreate) {
        const input: CreateSecretInput = {
          name: name.trim(),
          secret: secretValue.trim(),
        };
        if (account.trim()) input.account = account.trim();
        if (color) input.color = color;
        const success = await onCreate(input);
        if (success) onClose();
      }
    },
    [name, account, secretValue, color, isEdit, secret, onCreate, onUpdate, onClose]
  );

  if (!open) return null;

  return createPortal(
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

          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium mb-2">Color</label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Card color">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={color === opt.key}
                  aria-label={opt.label}
                  onClick={() => setColor(opt.key)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-all flex items-center justify-center",
                    opt.swatch,
                    color === opt.key
                      ? "border-foreground scale-110"
                      : "border-transparent hover:border-muted-foreground/50"
                  )}
                >
                  {color === opt.key && (
                    <Check className="h-3.5 w-3.5 text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
          </div>

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
    </div>,
    document.body
  );
}
