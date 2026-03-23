"use server";

/**
 * Backy integration server actions.
 *
 * Handles push to Backy, config CRUD, and pull webhook key management.
 * This is the sole action file for Backy — actions/backup.ts is not involved.
 */

import { getScopedDB } from "@/lib/auth-context";
import { VERSION } from "@/lib/version";
import { createEncryptedZip, generateArchiveFilename } from "@/models/backup-archive";
import {
  validateBackyConfig,
  maskApiKey,
  getBackyEnvironment,
  buildBackyTag,
  type BackyHistoryResponse,
  type BackyPushDetail,
} from "@/models/backy";
import type { ActionResult, ParsedSecret } from "@/models/types";

// ── Push ──────────────────────────────────────────────────────────────────

/**
 * Create an encrypted ZIP of all secrets and push it to Backy.
 * Server-side only — ZIP never crosses the RSC boundary.
 */
export async function pushBackupToBacky(): Promise<ActionResult<BackyPushDetail>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    const config = await db.getBackySettings();
    if (!config?.webhookUrl || !config?.apiKey) {
      return { success: false, error: "Backy not configured" };
    }

    const encryptionKey = await db.getEncryptionKey();
    if (!encryptionKey) {
      return { success: false, error: "No encryption key configured. Set up your encryption key in Settings first." };
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
      return {
        success: false,
        error: `Push failed (${res.status})`,
      };
    }

    // Consume the POST response
    await res.json().catch(() => null);

    // Fetch history inline to avoid an extra round-trip
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
      // Non-critical — history will be undefined
    }

    return {
      success: true,
      data: {
        ok: true,
        message: `Push successful (${durationMs}ms)`,
        durationMs,
        request: {
          tag,
          fileName,
          fileSizeBytes: zipBytes.byteLength,
          secretCount: secrets.length,
        },
        ...(history ? { history } : {}),
      },
    };
  } catch (error) {
    console.error("Failed to push backup:", error);
    return { success: false, error: "Failed to push backup" };
  }
}

// ── Config CRUD ───────────────────────────────────────────────────────────

/** Get the current Backy config (URL + masked key). */
export async function getBackyConfig(): Promise<
  ActionResult<{ webhookUrl: string; maskedApiKey: string } | null>
> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    const config = await db.getBackySettings();
    if (!config?.webhookUrl || !config?.apiKey) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        webhookUrl: config.webhookUrl,
        maskedApiKey: maskApiKey(config.apiKey),
      },
    };
  } catch (error) {
    console.error("Failed to get Backy config:", error);
    return { success: false, error: "Failed to load Backy config" };
  }
}

/** Save Backy config (webhook URL + API key). */
export async function saveBackyConfig(config: {
  webhookUrl: string;
  apiKey: string;
}): Promise<ActionResult<{ webhookUrl: string; maskedApiKey: string }>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    const validation = validateBackyConfig(config);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    await db.upsertBackySettings({
      webhookUrl: config.webhookUrl.trim(),
      apiKey: config.apiKey.trim(),
    });

    return {
      success: true,
      data: {
        webhookUrl: config.webhookUrl.trim(),
        maskedApiKey: maskApiKey(config.apiKey.trim()),
      },
    };
  } catch (error) {
    console.error("Failed to save Backy config:", error);
    return { success: false, error: "Failed to save Backy config" };
  }
}

/** Test connection to the Backy webhook (HEAD request). */
export async function testBackyConnection(): Promise<ActionResult<null>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    const config = await db.getBackySettings();
    if (!config?.webhookUrl || !config?.apiKey) {
      return { success: false, error: "Backy not configured" };
    }

    const res = await fetch(config.webhookUrl, {
      method: "HEAD",
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });

    if (!res.ok) {
      return { success: false, error: `Connection failed (${res.status})` };
    }

    return { success: true, data: null };
  } catch (error) {
    console.error("Backy connection test failed:", error);
    return { success: false, error: "Connection failed: unable to reach Backy" };
  }
}

/** Fetch backup history from Backy. */
export async function fetchBackyHistory(): Promise<ActionResult<BackyHistoryResponse>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    const config = await db.getBackySettings();
    if (!config?.webhookUrl || !config?.apiKey) {
      return { success: false, error: "Backy not configured" };
    }

    const res = await fetch(config.webhookUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });

    if (!res.ok) {
      return { success: false, error: `Failed to fetch history (${res.status})` };
    }

    const data: BackyHistoryResponse = await res.json();
    return { success: true, data };
  } catch (error) {
    console.error("Failed to fetch Backy history:", error);
    return { success: false, error: "Failed to fetch backup history" };
  }
}

// ── Pull Webhook Key CRUD ─────────────────────────────────────────────────

/** Get the current pull webhook key, or null if not configured. */
export async function getBackyPullWebhook(): Promise<ActionResult<string | null>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    const key = await db.getBackyPullWebhook();
    return { success: true, data: key };
  } catch (error) {
    console.error("Failed to get pull webhook:", error);
    return { success: false, error: "Failed to load pull webhook" };
  }
}

/** Generate (or regenerate) a pull webhook key. */
export async function generateBackyPullWebhook(): Promise<ActionResult<string>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    // Generate a 48-char random key
    const array = new Uint8Array(36);
    crypto.getRandomValues(array);
    const key = Array.from(array, (b) => b.toString(36).padStart(2, "0"))
      .join("")
      .slice(0, 48);

    await db.upsertBackyPullWebhook(key);
    return { success: true, data: key };
  } catch (error) {
    console.error("Failed to generate pull webhook:", error);
    return { success: false, error: "Failed to generate pull webhook" };
  }
}

/** Revoke the pull webhook key. */
export async function revokeBackyPullWebhook(): Promise<ActionResult<null>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    await db.deleteBackyPullWebhook();
    return { success: true, data: null };
  } catch (error) {
    console.error("Failed to revoke pull webhook:", error);
    return { success: false, error: "Failed to revoke pull webhook" };
  }
}
