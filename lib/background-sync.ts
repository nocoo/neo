/**
 * Background sync — replays offline queue entries when connectivity restores.
 *
 * Integrates with the offline-queue module and provides a replay mechanism
 * that can be triggered by the Service Worker's `sync` event or manually
 * from the main thread.
 */

import {
  getAll,
  remove,
  incrementRetry,
} from "@/lib/offline-queue";
import type { QueueEntry, OperationType } from "@/lib/offline-queue";

// ── Types ────────────────────────────────────────────────────────────────

/** Handler function for replaying a queued operation. */
export type ReplayHandler = (payload: unknown) => Promise<boolean>;

/** Result of a single replay attempt. */
export interface ReplayResult {
  id: number;
  type: OperationType;
  success: boolean;
}

/** Result of a full sync cycle. */
export interface SyncResult {
  total: number;
  succeeded: number;
  failed: number;
  results: ReplayResult[];
}

// ── Sync tag for Service Worker registration ─────────────────────────────

export const SYNC_TAG = "neo-offline-sync";

// ── Handler registry ─────────────────────────────────────────────────────

const handlers = new Map<OperationType, ReplayHandler>();

/** Register a replay handler for an operation type. */
export function registerHandler(
  type: OperationType,
  handler: ReplayHandler,
): void {
  handlers.set(type, handler);
}

/** Unregister a replay handler. */
export function unregisterHandler(type: OperationType): void {
  handlers.delete(type);
}

/** Clear all registered handlers. */
export function clearHandlers(): void {
  handlers.clear();
}

/** Get a registered handler (exposed for testing). */
export function getHandler(type: OperationType): ReplayHandler | undefined {
  return handlers.get(type);
}

// ── Replay logic ─────────────────────────────────────────────────────────

/** Replay a single queue entry. */
async function replayEntry(entry: QueueEntry): Promise<boolean> {
  const handler = handlers.get(entry.type);
  if (!handler) {
    // No handler registered — skip but don't remove
    return false;
  }

  try {
    const success = await handler(entry.payload);
    if (success) {
      await remove(entry.id!);
      return true;
    }

    // Handler returned false — increment retry
    await incrementRetry(entry.id!);
    return false;
  } catch {
    // Handler threw — increment retry
    await incrementRetry(entry.id!);
    return false;
  }
}

/** Replay all pending entries in FIFO order. */
export async function replayAll(): Promise<SyncResult> {
  const entries = await getAll();
  const results: ReplayResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const entry of entries) {
    const success = await replayEntry(entry);
    results.push({
      id: entry.id!,
      type: entry.type,
      success,
    });

    if (success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return {
    total: entries.length,
    succeeded,
    failed,
    results,
  };
}

// ── Service Worker sync registration ─────────────────────────────────────

/** Request a background sync (call from main thread). */
export async function requestSync(): Promise<boolean> {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if ("sync" in registration) {
      await (registration as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> };
      }).sync.register(SYNC_TAG);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Check if Background Sync API is supported. */
export function isSyncSupported(): boolean {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }
  return "SyncManager" in globalThis;
}
