/**
 * Background sync tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import "fake-indexeddb/auto";

import {
  registerHandler,
  unregisterHandler,
  clearHandlers,
  getHandler,
  replayAll,
  requestSync,
  isSyncSupported,
  SYNC_TAG,
} from "@/lib/background-sync";
import { enqueue, deleteDatabase } from "@/lib/offline-queue";

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(async () => {
  clearHandlers();
  await deleteDatabase();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("background-sync", () => {
  // ── Handler registry ─────────────────────────────────────────────────

  it("registers and retrieves a handler", () => {
    const handler = vi.fn();
    registerHandler("create_secret", handler);
    expect(getHandler("create_secret")).toBe(handler);
  });

  it("unregisters a handler", () => {
    registerHandler("create_secret", vi.fn());
    unregisterHandler("create_secret");
    expect(getHandler("create_secret")).toBeUndefined();
  });

  it("clears all handlers", () => {
    registerHandler("create_secret", vi.fn());
    registerHandler("update_secret", vi.fn());
    clearHandlers();
    expect(getHandler("create_secret")).toBeUndefined();
    expect(getHandler("update_secret")).toBeUndefined();
  });

  // ── replayAll ────────────────────────────────────────────────────────

  it("returns empty result when queue is empty", async () => {
    const result = await replayAll();
    expect(result).toEqual({
      total: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    });
  });

  it("replays entries with registered handlers", async () => {
    const handler = vi.fn().mockResolvedValue(true);
    registerHandler("create_secret", handler);

    await enqueue("create_secret", { name: "test" });
    const result = await replayAll();

    expect(result.total).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(handler).toHaveBeenCalledWith({ name: "test" });
  });

  it("marks entry as failed when handler returns false", async () => {
    const handler = vi.fn().mockResolvedValue(false);
    registerHandler("update_secret", handler);

    await enqueue("update_secret", { id: "1" });
    const result = await replayAll();

    expect(result.total).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
  });

  it("marks entry as failed when handler throws", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("network"));
    registerHandler("delete_secret", handler);

    await enqueue("delete_secret", { id: "1" });
    const result = await replayAll();

    expect(result.total).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
  });

  it("skips entries with no registered handler", async () => {
    // No handler registered for create_backup
    await enqueue("create_backup", { data: "json" });
    const result = await replayAll();

    expect(result.total).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results[0].success).toBe(false);
  });

  it("handles mixed success and failure", async () => {
    registerHandler("create_secret", vi.fn().mockResolvedValue(true));
    registerHandler("update_secret", vi.fn().mockResolvedValue(false));

    await enqueue("create_secret", { name: "ok" });
    await enqueue("update_secret", { id: "fail" });

    const result = await replayAll();
    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
  });

  // ── requestSync ──────────────────────────────────────────────────────

  it("returns false when navigator is not available", async () => {
    // jsdom doesn't have serviceWorker.ready with sync support
    const result = await requestSync();
    expect(result).toBe(false);
  });

  // ── isSyncSupported ──────────────────────────────────────────────────

  it("returns false in jsdom (no SyncManager)", () => {
    expect(isSyncSupported()).toBe(false);
  });

  // ── SYNC_TAG ─────────────────────────────────────────────────────────

  it("exports a sync tag constant", () => {
    expect(SYNC_TAG).toBe("neo-offline-sync");
  });
});
