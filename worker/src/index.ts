/**
 * Neo Worker — Cloudflare Worker entry point.
 *
 * Endpoints:
 *   GET /otp/:secret  — Quick OTP generation (public)
 *   GET /favicon/:domain — Favicon proxy with waterfall sources
 *
 * Scheduled:
 *   Daily backup (UTC 16:00) via D1
 */

import type { Env } from "./types";
import { handleRequest } from "./router";

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    return handleRequest(request, env);
  },

  async scheduled(
    _event: ScheduledEvent,
    _env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    // TODO: implement cron backup (commit #51)
  },
};
