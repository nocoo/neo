"use client";

/**
 * SecretFormDialog — shared form for creating and editing secrets.
 * Includes a color picker for assigning card colors.
 */

import { Check, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { CardThemeKey } from "@/components/secret-card";
import { resolveThemeKey } from "@/components/secret-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CreateSecretInput, Secret, UpdateSecretInput } from "@/models/types";

// ── Color options ────────────────────────────────────────────────────────

const COLOR_OPTIONS: { key: CardThemeKey; label: string; swatch: string }[] = [
  { key: "red", label: "Red", swatch: "bg-red-500" },
  { key: "emerald", label: "Emerald", swatch: "bg-emerald-600" },
  { key: "blue", label: "Blue", swatch: "bg-blue-500" },
  { key: "purple", label: "Purple", swatch: "bg-purple-500" },
  { key: "amber", label: "Amber", swatch: "bg-amber-500" },
  { key: "cyan", label: "Cyan", swatch: "bg-cyan-600" },
  { key: "pink", label: "Pink", swatch: "bg-pink-500" },
  { key: "indigo", label: "Indigo", swatch: "bg-indigo-500" },
  { key: "teal", label: "Teal", swatch: "bg-teal-600" },
  { key: "orange", label: "Orange", swatch: "bg-orange-500" },
  { key: "white", label: "White", swatch: "bg-white border border-gray-300" },
  { key: "black", label: "Black", swatch: "bg-gray-900" },
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
      // Resolve the effective displayed color (user-set or hash-derived)
      setColor(resolveThemeKey(secret));
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
        input.color = color;
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
    [name, account, secretValue, color, isEdit, secret, onCreate, onUpdate, onClose],
  );

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent aria-label={isEdit ? "Edit secret" : "Create secret"}>
        <div className="flex items-center justify-between mb-4">
          <DialogTitle className="text-lg font-semibold">
            {isEdit ? "Edit Secret" : "Add Secret"}
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="secret-name" className="block text-sm font-medium mb-1">
              Name *
            </label>
            <Input
              id="secret-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., GitHub"
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="secret-account" className="block text-sm font-medium mb-1">
              Account
            </label>
            <Input
              id="secret-account"
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="e.g., user@example.com"
              className="w-full"
            />
          </div>

          {!isEdit && (
            <div>
              <label htmlFor="secret-key" className="block text-sm font-medium mb-1">
                Secret Key *
              </label>
              <Input
                id="secret-key"
                type="text"
                value={secretValue}
                onChange={(e) => setSecretValue(e.target.value)}
                placeholder="Base32 encoded key"
                className="w-full font-mono"
              />
            </div>
          )}

          {/* Color picker */}
          <fieldset>
            <legend className="block text-sm font-medium mb-2">Color</legend>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  aria-pressed={color === opt.key}
                  aria-label={opt.label}
                  onClick={() => setColor(opt.key)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-all flex items-center justify-center",
                    opt.swatch,
                    color === opt.key
                      ? "border-basalt-foreground scale-110"
                      : "border-transparent hover:border-basalt-muted-foreground/50",
                  )}
                >
                  {color === opt.key && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
                </button>
              ))}
            </div>
          </fieldset>

          {formError && (
            <p className="text-sm text-basalt-destructive" role="alert">
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
      </DialogContent>
    </Dialog>
  );
}
