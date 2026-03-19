"use client";

/**
 * SecretCard — displays a single OTP secret with its current code.
 */

import { useState, useCallback } from "react";
import { Copy, Check, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Secret, OtpResult } from "@/models/types";

// ── Types ────────────────────────────────────────────────────────────────

export interface SecretCardProps {
  secret: Secret;
  otp?: OtpResult;
  onEdit?: (secret: Secret) => void;
  onDelete?: (id: string) => void;
}

// ── Component ────────────────────────────────────────────────────────────

export function SecretCard({ secret, otp, onEdit, onDelete }: SecretCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!otp?.otp) return;
    try {
      await navigator.clipboard.writeText(otp.otp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [otp?.otp]);

  const progressPercent = otp
    ? ((otp.period - otp.remainingSeconds) / otp.period) * 100
    : 0;

  return (
    <div
      className="group relative flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50"
      data-testid={`secret-card-${secret.id}`}
    >
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium truncate">{secret.name}</h3>
          {secret.type !== "totp" && (
            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {secret.type}
            </span>
          )}
        </div>
        {secret.account && (
          <p className="text-xs text-muted-foreground truncate">{secret.account}</p>
        )}
      </div>

      {/* OTP Display */}
      {otp && (
        <div className="flex items-center gap-2">
          <div className="text-right">
            <button
              type="button"
              onClick={handleCopy}
              className="font-mono text-lg font-bold tracking-widest tabular-nums cursor-pointer hover:text-primary transition-colors"
              title="Click to copy"
              aria-label={`Copy OTP ${otp.otp}`}
            >
              {otp.otp}
            </button>
            {/* Timer bar */}
            <div className="mt-1 h-0.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000 ease-linear",
                  otp.remainingSeconds <= 5 ? "bg-destructive" : "bg-primary"
                )}
                style={{ width: `${100 - progressPercent}%` }}
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-8 w-8"
            aria-label={copied ? "Copied" : "Copy OTP"}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(secret)}
            className="h-8 w-8"
            aria-label={`Edit ${secret.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(secret.id)}
            className="h-8 w-8 text-destructive hover:text-destructive"
            aria-label={`Delete ${secret.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
