/**
 * Offline queue tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";

import {
  enqueue,
  getAll,
  count,
  remove,
  incrementRetry,
  clear,
  deleteDatabase,
} from "@/lib/offline-queue";
import type { QueueEntry } from "@/lib/offline-queue";

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await deleteDatabase();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("offline-queue", () => {
  // ── enqueue ──────────────────────────────────────────────────────────

  it("enqueues an entry and returns an id", async () => {
    const id = await enqueue("create_secret", { name: "test" });
    expect(id).toBeGreaterThan(0);
  });

  it("enqueues multiple entries with incrementing ids", async () => {
    const id1 = await enqueue("create_secret", { name: "a" });
    const id2 = await enqueue("update_secret", { id: "1" });
    expect(id2).toBeGreaterThan(id1);
  });

  it("stores entry with correct fields", async () => {
    await enqueue("delete_secret", { id: "42" }, 5);
    const entries = await getAll();
    expect(entries).toHaveLength(1);

    const entry = entries[0]!;
    expect(entry.type).toBe("delete_secret");
    expect(entry.payload).toEqual({ id: "42" });
    expect(entry.retryCount).toBe(0);
    expect(entry.maxRetries).toBe(5);
    expect(entry.createdAt).toBeTruthy();
  });

  it("uses default max retries of 3", async () => {
    await enqueue("create_backup", { data: "json" });
    const entries = await getAll();
    expect(entries[0]!.maxRetries).toBe(3);
  });

  // ── getAll ───────────────────────────────────────────────────────────

  it("returns empty array when queue is empty", async () => {
    const entries = await getAll();
    expect(entries).toEqual([]);
  });

  it("returns entries in FIFO order", async () => {
    await enqueue("create_secret", { name: "first" });
    await enqueue("update_secret", { name: "second" });
    await enqueue("delete_secret", { id: "third" });

    const entries = await getAll();
    expect(entries).toHaveLength(3);
    expect((entries[0]!.payload as { name: string }).name).toBe("first");
    expect((entries[1]!.payload as { name: string }).name).toBe("second");
    expect((entries[2]!.payload as { id: string }).id).toBe("third");
  });

  // ── count ────────────────────────────────────────────────────────────

  it("returns 0 for empty queue", async () => {
    const n = await count();
    expect(n).toBe(0);
  });

  it("returns correct count after enqueuing", async () => {
    await enqueue("create_secret", {});
    await enqueue("create_secret", {});
    await enqueue("create_secret", {});
    expect(await count()).toBe(3);
  });

  // ── remove ───────────────────────────────────────────────────────────

  it("removes a specific entry by id", async () => {
    const id1 = await enqueue("create_secret", { name: "keep" });
    const id2 = await enqueue("update_secret", { name: "remove" });

    await remove(id2);

    const entries = await getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.id).toBe(id1);
  });

  it("is a no-op when removing non-existent id", async () => {
    await enqueue("create_secret", {});
    await remove(9999);
    expect(await count()).toBe(1);
  });

  // ── incrementRetry ───────────────────────────────────────────────────

  it("increments retry count", async () => {
    const id = await enqueue("create_secret", {});
    const updated = await incrementRetry(id);
    expect(updated).not.toBeNull();
    expect((updated as QueueEntry).retryCount).toBe(1);
  });

  it("returns updated entry after increment", async () => {
    const id = await enqueue("update_secret", { data: "test" }, 5);

    await incrementRetry(id);
    const updated = await incrementRetry(id);
    expect(updated).not.toBeNull();
    expect((updated as QueueEntry).retryCount).toBe(2);
  });

  it("removes entry and returns null when max retries exceeded", async () => {
    const id = await enqueue("create_secret", {}, 1);

    // First increment: retryCount = 1, within maxRetries
    const first = await incrementRetry(id);
    expect(first).not.toBeNull();
    expect((first as QueueEntry).retryCount).toBe(1);

    // Second increment: retryCount = 2 > maxRetries of 1, removed
    const second = await incrementRetry(id);
    expect(second).toBeNull();
    expect(await count()).toBe(0);
  });

  it("returns null for non-existent id", async () => {
    const result = await incrementRetry(9999);
    expect(result).toBeNull();
  });

  // ── clear ────────────────────────────────────────────────────────────

  it("clears all entries", async () => {
    await enqueue("create_secret", {});
    await enqueue("update_secret", {});
    await enqueue("delete_secret", {});

    await clear();
    expect(await count()).toBe(0);
  });

  it("is safe to clear an empty queue", async () => {
    await clear();
    expect(await count()).toBe(0);
  });

  // ── deleteDatabase ───────────────────────────────────────────────────

  it("deletes the database completely", async () => {
    await enqueue("create_secret", {});
    await deleteDatabase();

    // After deletion, opening again should create a fresh db
    const entries = await getAll();
    expect(entries).toEqual([]);
  });
});
