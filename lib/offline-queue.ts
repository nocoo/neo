/**
 * Offline queue — IndexedDB-backed queue for pending operations.
 *
 * Operations are enqueued when the app is offline and replayed
 * when connectivity is restored. Each entry has a unique ID,
 * a type discriminator, serialised payload, and retry metadata.
 */

// ── Types ────────────────────────────────────────────────────────────────

export type OperationType =
  | "create_secret"
  | "update_secret"
  | "delete_secret"
  | "create_backup";

export interface QueueEntry {
  /** Auto-incremented by IndexedDB. */
  id?: number;
  /** Discriminator for replay routing. */
  type: OperationType;
  /** JSON-serialisable payload. */
  payload: unknown;
  /** ISO-8601 timestamp of enqueue. */
  createdAt: string;
  /** Number of replay attempts so far. */
  retryCount: number;
  /** Max retries before the entry is discarded. */
  maxRetries: number;
}

// ── Constants ────────────────────────────────────────────────────────────

const DB_NAME = "neo-offline-queue";
const DB_VERSION = 1;
const STORE_NAME = "operations";
const DEFAULT_MAX_RETRIES = 3;

// ── Helpers ──────────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(
  db: IDBDatabase,
  mode: IDBTransactionMode,
): IDBObjectStore {
  const tx = db.transaction(STORE_NAME, mode);
  return tx.objectStore(STORE_NAME);
}

// ── Public API ───────────────────────────────────────────────────────────

/** Enqueue an operation for later replay. */
export async function enqueue(
  type: OperationType,
  payload: unknown,
  maxRetries: number = DEFAULT_MAX_RETRIES,
): Promise<number> {
  const db = await openDb();
  try {
    const entry: QueueEntry = {
      type,
      payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries,
    };

    return await new Promise<number>((resolve, reject) => {
      const store = txStore(db, "readwrite");
      const request = store.add(entry);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** Return all pending entries in FIFO order. */
export async function getAll(): Promise<QueueEntry[]> {
  const db = await openDb();
  try {
    return await new Promise<QueueEntry[]>((resolve, reject) => {
      const store = txStore(db, "readonly");
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as QueueEntry[]);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** Get the number of pending entries. */
export async function count(): Promise<number> {
  const db = await openDb();
  try {
    return await new Promise<number>((resolve, reject) => {
      const store = txStore(db, "readonly");
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** Remove a single entry by ID (after successful replay). */
export async function remove(id: number): Promise<void> {
  const db = await openDb();
  try {
    return await new Promise<void>((resolve, reject) => {
      const store = txStore(db, "readwrite");
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** Increment retry count for a failed entry. Returns the updated entry or null if max exceeded. */
export async function incrementRetry(id: number): Promise<QueueEntry | null> {
  const db = await openDb();
  try {
    return await new Promise<QueueEntry | null>((resolve, reject) => {
      const store = txStore(db, "readwrite");
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const entry = getReq.result as QueueEntry | undefined;
        if (!entry) {
          resolve(null);
          return;
        }

        entry.retryCount += 1;

        if (entry.retryCount > entry.maxRetries) {
          // Exceeded max — remove from queue
          const delReq = store.delete(id);
          delReq.onsuccess = () => resolve(null);
          delReq.onerror = () => reject(delReq.error);
          return;
        }

        const putReq = store.put(entry);
        putReq.onsuccess = () => resolve(entry);
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  } finally {
    db.close();
  }
}

/** Clear all entries. */
export async function clear(): Promise<void> {
  const db = await openDb();
  try {
    return await new Promise<void>((resolve, reject) => {
      const store = txStore(db, "readwrite");
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** Delete the entire database (for testing / cleanup). */
export async function deleteDatabase(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
