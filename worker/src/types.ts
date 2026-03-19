/**
 * Worker environment bindings.
 */
export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  ENCRYPTION_KEY?: string;
}
