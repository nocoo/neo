"use client";

/**
 * Offline fallback page — displayed when the user navigates while offline
 * and the requested page is not in the service worker cache.
 */

import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-6">
            <WifiOff className="h-12 w-12 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">You&apos;re Offline</h1>
          <p className="text-sm text-muted-foreground">
            It looks like you&apos;ve lost your internet connection.
            Some features may be unavailable until you reconnect.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => window.location.reload()}
            className="w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>

          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="w-full"
          >
            Go Back
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Changes made while offline will be synced automatically
          when your connection is restored.
        </p>
      </div>
    </div>
  );
}
