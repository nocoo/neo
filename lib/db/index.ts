/**
 * Database module — public API.
 * Re-exports ScopedDB and D1 client for use by actions and auth.
 */

export { ScopedDB } from "./scoped";
export { executeD1Query, isD1Configured } from "./d1-client";
export { rowToSecret, rowToUserSettings } from "./mappers";
