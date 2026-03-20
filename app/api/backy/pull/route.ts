/**
 * POST /api/backy/pull
 *
 * Webhook endpoint called by Backy to trigger a backup push.
 * Authentication via X-Webhook-Key header (matched against user_settings.backy_pull_key).
 *
 * On success, gathers all user secrets, creates encrypted ZIP, pushes to Backy, returns 200.
 *
 * HEAD /api/backy/pull
 *
 * Connection test endpoint. Verifies the key is valid.
 * Returns 200 with no body on success, 401 if invalid.
 */

import { NextResponse } from "next/server";
import { ScopedDB, verifyBackyPullWebhook } from "@/lib/db/scoped";
import { VERSION } from "@/lib/version";
import { createEncryptedZip, generateArchiveFilename } from "@/models/backup-archive";
import {
  getBackyEnvironment,
  buildBackyTag,
  type BackyHistoryResponse,
} from "@/models/backy";
import type { ParsedSecret } from "@/models/types";

export async function POST(request: Request) {
  const key = request.headers.get("x-webhook-key");

  if (!key) {
    return NextResponse.json(
      { error: "Missing X-Webhook-Key header" },
      { status: 401 },
    );
  }

  // Verify credentials
  const result = await verifyBackyPullWebhook(key);
  if (!result) {
    return NextResponse.json(
      { error: "Invalid webhook credentials" },
      { status: 401 },
    );
  }

  // Get user's Backy push config
  const db = new ScopedDB(result.userId);
  const config = await db.getBackySettings();
  if (!config?.webhookUrl || !config?.apiKey) {
    return NextResponse.json(
      { error: "Backy push config not configured" },
      { status: 422 },
    );
  }

  const encryptionKey = await db.getEncryptionKey();
  if (!encryptionKey) {
    return NextResponse.json(
      { error: "No encryption key configured" },
      { status: 422 },
    );
  }

  const start = Date.now();

  // Gather secrets
  const secrets = await db.getSecrets();
  const parsed: ParsedSecret[] = secrets.map((s) => ({
    name: s.name,
    account: s.account ?? "",
    secret: s.secret,
    type: s.type,
    digits: s.digits,
    period: s.period,
    algorithm: s.algorithm,
    counter: s.counter,
  }));

  // Create encrypted ZIP
  const zipBytes = await createEncryptedZip(parsed, encryptionKey);
  const fileName = generateArchiveFilename();
  const tag = buildBackyTag(VERSION, secrets.length);

  // Push to Backy as multipart/form-data
  const form = new FormData();
  const blob = new Blob([zipBytes.buffer as ArrayBuffer], { type: "application/zip" });
  form.append("file", blob, fileName);
  form.append("environment", getBackyEnvironment());
  form.append("tag", tag);

  const res = await fetch(config.webhookUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: form,
  });

  const durationMs = Date.now() - start;

  if (!res.ok) {
    let body: unknown;
    const text = await res.text().catch(() => "");
    try { body = JSON.parse(text); } catch { body = text || null; }
    return NextResponse.json(
      {
        error: "Backup push failed",
        durationMs,
        status: res.status,
        body,
      },
      { status: 502 },
    );
  }

  // Consume response body
  await res.json().catch(() => null);

  // Fetch history inline
  let history: BackyHistoryResponse | undefined;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const historyRes = await fetch(config.webhookUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (historyRes.ok) {
      history = await historyRes.json();
    }
  } catch {
    // Non-critical
  }

  return NextResponse.json({
    ok: true,
    message: `Backup pushed successfully (${durationMs}ms)`,
    durationMs,
    tag,
    fileName,
    stats: { secrets: secrets.length },
    history,
  });
}

/**
 * HEAD /api/backy/pull — connection test.
 */
export async function HEAD(request: Request) {
  const key = request.headers.get("x-webhook-key");

  if (!key) {
    return new Response(null, { status: 401 });
  }

  const result = await verifyBackyPullWebhook(key);
  if (!result) {
    return new Response(null, { status: 401 });
  }

  return new Response(null, { status: 200 });
}
