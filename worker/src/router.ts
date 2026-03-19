/**
 * Worker request router.
 * Maps URL paths to handler functions.
 */

import type { Env } from "./types";
import { handleOtp } from "./otp";
import { handleFavicon } from "./favicon";
import { createJsonResponse } from "./utils/response";
import { getSecurityHeaders, createPreflightResponse } from "./security";
import {
  checkRateLimit,
  getClientIdentifier,
  createRateLimitResponse,
  RATE_LIMIT_PRESETS,
} from "./rate-limit";

/**
 * Route incoming requests to the appropriate handler.
 */
export async function handleRequest(
  request: Request,
  env: Env
): Promise<Response> {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return createPreflightResponse(request);
  }

  const url = new URL(request.url);
  const path = url.pathname;

  // Apply rate limiting (skip health check)
  if (path !== "/health") {
    const clientId = getClientIdentifier(request);
    const preset = path.startsWith("/otp/")
      ? RATE_LIMIT_PRESETS.otp
      : RATE_LIMIT_PRESETS.api;
    const rateLimitResult = checkRateLimit(clientId, preset);
    if (!rateLimitResult.allowed) {
      return withSecurityHeaders(
        request,
        createRateLimitResponse(rateLimitResult)
      );
    }
  }

  // GET /otp/:secret
  const otpMatch = path.match(/^\/otp\/(.+)$/);
  if (otpMatch && request.method === "GET") {
    const response = await handleOtp(otpMatch[1], url.searchParams, env);
    return withSecurityHeaders(request, response);
  }

  // GET /favicon/:domain
  const faviconMatch = path.match(/^\/favicon\/(.+)$/);
  if (faviconMatch && request.method === "GET") {
    const response = await handleFavicon(faviconMatch[1]);
    return withSecurityHeaders(request, response);
  }

  // Health check
  if (path === "/health" && request.method === "GET") {
    return withSecurityHeaders(
      request,
      createJsonResponse({ status: "ok", timestamp: new Date().toISOString() })
    );
  }

  // 404
  return withSecurityHeaders(
    request,
    createJsonResponse({ error: "Not found" }, 404)
  );
}

function withSecurityHeaders(request: Request, response: Response): Response {
  const headers = getSecurityHeaders(request);
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
