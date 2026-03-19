/**
 * Unified security headers module (fix P3).
 * Dynamic same-origin CORS instead of hardcoded `*`.
 */

const SENSITIVE_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

/**
 * Check if an origin is allowed (dynamic same-origin).
 */
export function isOriginAllowed(origin: string, request: Request): boolean {
  if (!origin) return false;

  const host = request.headers.get("host");
  if (!host) return false;

  // Same-origin check
  const allowedOrigins = [`https://${host}`, `http://${host}`];
  if (allowedOrigins.includes(origin)) return true;

  // Localhost/127.0.0.1 cross-port relaxation for dev
  try {
    const originUrl = new URL(origin);
    const hostName = host.split(":")[0];
    if (
      (originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1") &&
      (hostName === "localhost" || hostName === "127.0.0.1")
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Get allowed origin for CORS (returns specific origin, not *).
 */
export function getAllowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  return isOriginAllowed(origin, request) ? origin : null;
}

/**
 * Get full security headers for a response.
 */
export function getSecurityHeaders(
  request: Request,
  options: { includeCSP?: boolean; includeCors?: boolean } = {}
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  };

  if (options.includeCSP !== false) {
    headers["Content-Security-Policy"] = SENSITIVE_CSP;
  }

  if (options.includeCors !== false) {
    const allowedOrigin = getAllowedOrigin(request);
    if (allowedOrigin) {
      headers["Access-Control-Allow-Origin"] = allowedOrigin;
      headers["Access-Control-Allow-Credentials"] = "true";
      headers["Vary"] = "Origin";
    }
  }

  return headers;
}

/**
 * Create a CORS preflight (204) response.
 */
export function createPreflightResponse(request: Request): Response {
  const origin = request.headers.get("origin");
  if (!origin || !isOriginAllowed(origin, request)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    },
  });
}
