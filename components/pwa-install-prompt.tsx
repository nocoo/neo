"use client";

/**
 * PWA install prompt — shows a banner when the app can be installed.
 *
 * Listens for the `beforeinstallprompt` event, defers it, and shows
 * a dismissible banner. When the user clicks "Install", the deferred
 * prompt is triggered.
 */

import { useState, useEffect, useCallback } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ────────────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ── Component ────────────────────────────────────────────────────────────

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setDeferredPrompt(null);
  }, []);

  // Don't render if no prompt or dismissed
  if (!deferredPrompt || dismissed) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-card bg-secondary p-4"
      role="banner"
      data-testid="pwa-install-prompt"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">Install Neo</p>
          <p className="text-xs text-muted-foreground">
            Add Neo to your home screen for quick access and offline support.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={handleInstall} className="flex-1">
          Install
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDismiss}
          className="flex-1"
        >
          Not Now
        </Button>
      </div>
    </div>
  );
}
