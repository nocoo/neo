/**
 * ID generation utilities for the worker.
 * Centralized to ensure consistent format across modules.
 */

/**
 * Generate a unique ID with a prefix.
 *
 * Format: `<prefix>_<timestamp_base36>_<random_6chars>`
 *
 * @param prefix - Short prefix (e.g., "bk" for backup, "s" for secret)
 */
export function generateId(prefix: string = "id"): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}
