"use client";

/**
 * SecretCard — card-style OTP display inspired by macOS authenticator widgets.
 * Shows name + account on top, large OTP code at bottom.
 * Click the entire card to copy OTP. Supports colored backgrounds via
 * user-defined color or a deterministic hash of the secret name's first word.
 */

import { useState, useCallback, useMemo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Secret, OtpResult } from "@/models/types";

// ── Color palette ─────────────────────────────────────────────────────────

export const CARD_THEMES = [
  { key: "default",  bg: "bg-card",              text: "text-card-foreground",   accent: "text-muted-foreground", progressBg: "bg-muted",         progressFill: "bg-primary",      progressWarn: "bg-destructive" },
  { key: "red",      bg: "bg-red-500",           text: "text-white",             accent: "text-red-100",          progressBg: "bg-red-400/40",    progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "emerald",  bg: "bg-emerald-600",       text: "text-white",             accent: "text-emerald-100",      progressBg: "bg-emerald-400/40",progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "zinc",     bg: "bg-zinc-800",          text: "text-white",             accent: "text-zinc-300",         progressBg: "bg-zinc-600/40",   progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "blue",     bg: "bg-blue-500",          text: "text-white",             accent: "text-blue-100",         progressBg: "bg-blue-400/40",   progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "purple",   bg: "bg-purple-500",        text: "text-white",             accent: "text-purple-100",       progressBg: "bg-purple-400/40", progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "amber",    bg: "bg-amber-500",         text: "text-white",             accent: "text-amber-100",        progressBg: "bg-amber-400/40",  progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "cyan",     bg: "bg-cyan-600",          text: "text-white",             accent: "text-cyan-100",         progressBg: "bg-cyan-400/40",   progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "pink",     bg: "bg-pink-500",          text: "text-white",             accent: "text-pink-100",         progressBg: "bg-pink-400/40",   progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "indigo",   bg: "bg-indigo-500",        text: "text-white",             accent: "text-indigo-100",       progressBg: "bg-indigo-400/40", progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "teal",     bg: "bg-teal-600",          text: "text-white",             accent: "text-teal-100",         progressBg: "bg-teal-400/40",   progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "orange",   bg: "bg-orange-500",        text: "text-white",             accent: "text-orange-100",       progressBg: "bg-orange-400/40", progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
] as const;

export type CardThemeKey = (typeof CARD_THEMES)[number]["key"];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Extract the first word (letters/numbers) from a name for hashing. */
function firstWord(name: string): string {
  const match = name.match(/^[\p{L}\p{N}]+/u);
  return match ? match[0] : name;
}

function getThemeByKey(key: string) {
  return CARD_THEMES.find((t) => t.key === key);
}

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

  const theme = useMemo(() => {
    // User-defined color takes priority
    if (secret.color) {
      const userTheme = getThemeByKey(secret.color);
      if (userTheme) return userTheme;
    }
    // Fallback: hash the first word of the name
    return CARD_THEMES[hashCode(firstWord(secret.name)) % CARD_THEMES.length];
  }, [secret.color, secret.name]);

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
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl p-4 transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer min-h-[130px]",
        theme.bg,
        theme.text,
        // Default card variant gets a border
        theme.bg === "bg-card" && "border border-border",
        // Visual feedback when copied
        copied && "ring-2 ring-white/50"
      )}
      data-testid={`secret-card-${secret.id}`}
      onClick={handleCopy}
    >
      {/* Top row: info */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold truncate leading-tight">
            {secret.name}
          </h3>
          {secret.account && (
            <p className={cn("text-xs truncate mt-0.5", theme.accent)}>
              {secret.account}
            </p>
          )}
          {secret.type !== "totp" && (
            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/20 mt-1 inline-block">
              {secret.type}
            </span>
          )}
        </div>
      </div>

      {/* Bottom: large OTP code */}
      {otp && (
        <div className="mt-auto pt-2">
          <div className="font-mono text-2xl font-bold tracking-widest tabular-nums leading-tight">
            {otp.otp}
          </div>
          {/* Timer bar */}
          <div className={cn("mt-2 h-1 w-full rounded-full overflow-hidden", theme.progressBg)}>
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-linear",
                otp.remainingSeconds <= 5 ? theme.progressWarn : theme.progressFill
              )}
              style={{ width: `${100 - progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Hover actions: edit & delete */}
      <div className={cn(
        "absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
      )}>
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(secret);
            }}
            className={cn(
              "h-7 w-7",
              theme.bg === "bg-card"
                ? "hover:bg-accent"
                : "hover:bg-white/20 text-white"
            )}
            aria-label={`Edit ${secret.name}`}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(secret.id);
            }}
            className={cn(
              "h-7 w-7",
              theme.bg === "bg-card"
                ? "hover:bg-destructive/10 text-destructive"
                : "hover:bg-white/20 text-white"
            )}
            aria-label={`Delete ${secret.name}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
