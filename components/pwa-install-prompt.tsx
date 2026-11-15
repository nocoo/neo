"use client";

/**
 * PWA install prompt — shows a banner when the app can be installed.
 *
 * Listens for the `beforeinstallprompt` event, defers it, and shows
 * a dismissible banner. When the user clicks "Install", the deferred
 * prompt is triggered.
 */

import { Download, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Banner } from "@/components/ui/banner";

// ── Types ────────────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ── Component ────────────────────────────────────────────────────────────

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
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
      data-testid="pwa-install-prompt"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md"
    >
      <Banner
        variant="secondary"
        size="sm"
        title="Install Neo"
        description="Add Neo to your home screen for quick access and offline support."
        icon={
          <div className="rounded-full bg-basalt-primary/10 p-2">
            <Download className="h-5 w-5 text-basalt-primary" />
          </div>
        }
        action={
          <>
            <Banner.Action
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              aria-label="Dismiss install prompt"
            >
              <X className="h-4 w-4" />
            </Banner.Action>
            <Banner.Action variant="outline" onClick={handleDismiss}>
              Not Now
            </Banner.Action>
            <Banner.Action onClick={handleInstall}>Install</Banner.Action>
          </>
        }
        data-testid="pwa-install-banner"
        className="w-full border border-basalt-border bg-basalt-card p-4 shadow-lg"
      />
    </div>
  );
}
