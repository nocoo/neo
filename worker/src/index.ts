/**
 * Neo Worker — Cloudflare Worker entry point.
 *
 * Endpoints:
 *   POST /otp — Quick OTP generation (public, secret in body)
 *   GET /favicon/:domain — Favicon proxy with waterfall sources
 */

import { handleRequest } from "./router";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env);
  },
};
