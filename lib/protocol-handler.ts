/**
 * Protocol handler — registers web+otpauth:// protocol.
 *
 * When the user clicks an otpauth:// link on a page that has been
 * modified to use web+otpauth://, the browser redirects to
 * /dashboard?otpauth=<encoded-uri> where the app can parse and import
 * the secret.
 */

// ── Constants ────────────────────────────────────────────────────────────

export const PROTOCOL = "web+otpauth";
export const HANDLER_URL = "/dashboard?otpauth=%s";

// ── Public API ───────────────────────────────────────────────────────────

/** Check if the Protocol Handler API is available. */
export function isProtocolHandlerSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "registerProtocolHandler" in navigator
  );
}

/**
 * Register the web+otpauth:// protocol handler.
 *
 * Must be called from a user gesture context in most browsers.
 * Silently returns false if the API is not available or registration fails.
 */
export function registerProtocolHandler(): boolean {
  if (!isProtocolHandlerSupported()) {
    return false;
  }

  try {
    navigator.registerProtocolHandler(PROTOCOL, HANDLER_URL);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse an otpauth URI from URL search params.
 *
 * After protocol handler redirect, the URL will contain:
 * ?otpauth=web%2Botpauth%3A%2F%2Ftotp%2FExample%3Fsecret%3DABC...
 *
 * This function extracts and normalizes the URI back to
 * otpauth://totp/Example?secret=ABC...
 */
export function parseOtpauthParam(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get("otpauth");
  if (!raw) {
    return null;
  }

  // The protocol handler replaces web+otpauth:// with the redirect URL,
  // so the param value starts with "web+otpauth://..."
  // Normalize to standard otpauth://
  const normalized = raw.replace(/^web\+otpauth:\/\//, "otpauth://");

  // Basic validation: must start with otpauth://
  if (!normalized.startsWith("otpauth://")) {
    return null;
  }

  return normalized;
}
