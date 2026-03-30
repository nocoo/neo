"use client";

/**
 * SecretCard — card-style OTP display inspired by macOS authenticator widgets.
 * Shows name + account on top, large OTP code at bottom.
 * Click the entire card to copy OTP with a 3D flip animation.
 * Supports colored backgrounds via user-defined color or deterministic hash.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Pencil, Trash2, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Secret, OtpResult } from "@/models/types";

// ── Color palette ────────────────────────────────────────────────────────

/** Saturated themes used for auto-hash assignment. */
export const HASH_THEMES = [
  { key: "red",      bg: "bg-red-500",           text: "text-white",             accent: "text-red-100",          progressBg: "bg-red-400/40",    progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "emerald",  bg: "bg-emerald-600",       text: "text-white",             accent: "text-emerald-100",      progressBg: "bg-emerald-400/40",progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "blue",     bg: "bg-blue-500",          text: "text-white",             accent: "text-blue-100",         progressBg: "bg-blue-400/40",   progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "purple",   bg: "bg-purple-500",        text: "text-white",             accent: "text-purple-100",       progressBg: "bg-purple-400/40", progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "amber",    bg: "bg-amber-500",         text: "text-white",             accent: "text-amber-100",        progressBg: "bg-amber-400/40",  progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "cyan",     bg: "bg-cyan-600",          text: "text-white",             accent: "text-cyan-100",         progressBg: "bg-cyan-400/40",   progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "pink",     bg: "bg-pink-500",          text: "text-white",             accent: "text-pink-100",         progressBg: "bg-pink-400/40",   progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "indigo",   bg: "bg-indigo-500",        text: "text-white",             accent: "text-indigo-100",       progressBg: "bg-indigo-400/40", progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "teal",     bg: "bg-teal-600",          text: "text-white",             accent: "text-teal-100",         progressBg: "bg-teal-400/40",   progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
  { key: "orange",   bg: "bg-orange-500",        text: "text-white",             accent: "text-orange-100",       progressBg: "bg-orange-400/40", progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
] as const;

/** Extra themes only available for manual selection (not auto-hash). */
const MANUAL_ONLY_THEMES = [
  { key: "white",    bg: "bg-white",             text: "text-gray-800",          accent: "text-gray-500",         progressBg: "bg-gray-200",      progressFill: "bg-gray-500/70",  progressWarn: "bg-yellow-500"  },
  { key: "black",    bg: "bg-gray-900",          text: "text-white",             accent: "text-gray-400",         progressBg: "bg-gray-700",      progressFill: "bg-white/70",     progressWarn: "bg-yellow-300"  },
] as const;

/** All themes — hash themes + manual-only themes. */
export const CARD_THEMES = [...HASH_THEMES, ...MANUAL_ONLY_THEMES] as const;

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

/** Resolve the effective theme key for a secret (user color or hash). */
export function resolveThemeKey(secret: { name: string; color?: string | null }): string {
  if (secret.color) {
    const found = getThemeByKey(secret.color);
    if (found) return found.key;
  }
  // HASH_THEMES is non-empty and modulo guarantees a valid index
  const hashTheme = HASH_THEMES[hashCode(firstWord(secret.name)) % HASH_THEMES.length];
  if (!hashTheme) return HASH_THEMES[0]?.key ?? "default";
  return hashTheme.key;
}

// ── Types ────────────────────────────────────────────────────────────────

export interface SecretCardProps {
  secret: Secret;
  otp?: OtpResult;
  onEdit?: (secret: Secret) => void;
  onDelete?: (id: string) => void;
  /** Whether this card is keyboard-selected (shows ring highlight). */
  selected?: boolean;
  /** Incrementing number — each change triggers the copy/flip animation. */
  copyTrigger?: number;
}

// ── Component ────────────────────────────────────────────────────────────

export function SecretCard({ secret, otp, onEdit, onDelete, selected, copyTrigger }: SecretCardProps) {
  const [flipped, setFlipped] = useState(false);
  const prevCopyTrigger = useRef(copyTrigger ?? 0);

  const theme = useMemo(() => {
    if (secret.color) {
      const userTheme = getThemeByKey(secret.color);
      if (userTheme) return userTheme;
    }
    // HASH_THEMES is non-empty and modulo guarantees a valid index
    const fallback = HASH_THEMES[hashCode(firstWord(secret.name)) % HASH_THEMES.length];
    return fallback ?? HASH_THEMES[0];
  }, [secret.color, secret.name]);

  const handleCopy = useCallback(async () => {
    if (!otp?.otp || flipped) return;
    try {
      await navigator.clipboard.writeText(otp.otp);
      setFlipped(true);
      setTimeout(() => setFlipped(false), 1200);
    } catch {
      // Clipboard API not available
    }
  }, [otp?.otp, flipped]);

  // Programmatic copy via copyTrigger prop
  useEffect(() => {
    if (copyTrigger !== undefined && copyTrigger !== prevCopyTrigger.current) {
      prevCopyTrigger.current = copyTrigger;
      handleCopy();
    }
  }, [copyTrigger, handleCopy]);

  const progressPercent = otp
    ? ((otp.period - otp.remainingSeconds) / otp.period) * 100
    : 0;

  return (
    <div
      className={cn(
        "cursor-pointer rounded-2xl transition-shadow",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
      style={{ perspective: "800px" }}
      data-testid={`secret-card-${secret.id}`}
      onClick={handleCopy}
    >
      {/* Flip container — relative so it sizes to the front face content */}
      <div
        className="relative transition-transform duration-500 ease-in-out [transform-style:preserve-3d]"
        style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* ── Front face — in normal flow to define card height ── */}
        <div
          className={cn(
            "group flex flex-col justify-between rounded-2xl p-4 min-h-[130px]",
            "[backface-visibility:hidden]",
            theme.bg,
            theme.text,
          )}
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
              <div className="font-display font-mono text-2xl font-bold tracking-widest tabular-nums leading-tight">
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
          <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(secret);
                }}
                className="h-7 w-7 hover:bg-white/20 text-white"
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
                className="h-7 w-7 hover:bg-white/20 text-white"
                aria-label={`Delete ${secret.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* ── Back face (Copied!) — absolute, sized to match front ── */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center rounded-2xl overflow-hidden",
            "[backface-visibility:hidden] [transform:rotateY(180deg)]",
            theme.bg,
            theme.text,
          )}
          aria-hidden={!flipped}
        >
          {/* White overlay to lighten the back face */}
          <div className="absolute inset-0 bg-white/20 pointer-events-none" />
          <ClipboardCheck className="relative h-8 w-8 mb-2 drop-shadow" />
          <span className="relative text-lg font-bold drop-shadow">Copied!</span>
        </div>
      </div>
    </div>
  );
}
