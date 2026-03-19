"use server";

/**
 * Secret CRUD Server Actions.
 *
 * All actions return ActionResult<T> — never throw.
 * Auth is enforced via getScopedDB() which binds userId at construction.
 */

import { getScopedDB } from "@/lib/auth-context";
import { validateSecretData, validateBase32 } from "@/models/validation";
import { OTP_DEFAULTS } from "@/models/constants";
import type { ActionResult, Secret, CreateSecretInput, UpdateSecretInput } from "@/models/types";

/**
 * List all secrets for the authenticated user.
 */
export async function getSecrets(): Promise<ActionResult<Secret[]>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    const secrets = await db.getSecrets();
    return { success: true, data: secrets };
  } catch (error) {
    console.error("Failed to get secrets:", error);
    return { success: false, error: "Failed to load secrets" };
  }
}

/**
 * Get a single secret by ID.
 */
export async function getSecretById(
  id: string
): Promise<ActionResult<Secret>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    if (!id) return { success: false, error: "Secret ID is required" };

    const secret = await db.getSecretById(id);
    if (!secret) return { success: false, error: "Secret not found" };

    return { success: true, data: secret };
  } catch (error) {
    console.error("Failed to get secret:", error);
    return { success: false, error: "Failed to load secret" };
  }
}

/**
 * Create a new secret.
 */
export async function createSecret(
  input: CreateSecretInput
): Promise<ActionResult<Secret>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      return { success: false, error: "Name is required" };
    }

    // Validate secret (base32)
    if (!input.secret || !validateBase32(input.secret).valid) {
      return { success: false, error: "Invalid secret: must be valid base32" };
    }

    // Validate full secret data
    const validation = validateSecretData({
      name: input.name,
      secret: input.secret,
    });

    if (!validation.valid) {
      return { success: false, error: validation.error ?? "Invalid secret data" };
    }

    const id = `s_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

    const secret = await db.createSecret({
      id,
      name: input.name.trim(),
      account: input.account?.trim() || null,
      secret: input.secret.toUpperCase().replace(/\s/g, ""),
      type: input.type ?? OTP_DEFAULTS.type,
      digits: input.digits ?? OTP_DEFAULTS.digits,
      period: input.period ?? OTP_DEFAULTS.period,
      algorithm: input.algorithm ?? OTP_DEFAULTS.algorithm,
      counter: input.counter ?? OTP_DEFAULTS.counter,
    });

    return { success: true, data: secret };
  } catch (error) {
    console.error("Failed to create secret:", error);
    return { success: false, error: "Failed to create secret" };
  }
}

/**
 * Update an existing secret.
 */
export async function updateSecret(
  input: UpdateSecretInput
): Promise<ActionResult<Secret>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    if (!input.id) return { success: false, error: "Secret ID is required" };

    // If secret value is being updated, validate it
    if (input.secret !== undefined && !validateBase32(input.secret).valid) {
      return { success: false, error: "Invalid secret: must be valid base32" };
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.account !== undefined) updateData.account = input.account?.trim() || null;
    if (input.secret !== undefined) updateData.secret = input.secret.toUpperCase().replace(/\s/g, "");
    if (input.type !== undefined) updateData.type = input.type;
    if (input.digits !== undefined) updateData.digits = input.digits;
    if (input.period !== undefined) updateData.period = input.period;
    if (input.algorithm !== undefined) updateData.algorithm = input.algorithm;
    if (input.counter !== undefined) updateData.counter = input.counter;

    const secret = await db.updateSecret(input.id, updateData);
    if (!secret) return { success: false, error: "Secret not found" };

    return { success: true, data: secret };
  } catch (error) {
    console.error("Failed to update secret:", error);
    return { success: false, error: "Failed to update secret" };
  }
}

/**
 * Delete a secret by ID.
 */
export async function deleteSecret(
  id: string
): Promise<ActionResult<void>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    if (!id) return { success: false, error: "Secret ID is required" };

    await db.deleteSecret(id);
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Failed to delete secret:", error);
    return { success: false, error: "Failed to delete secret" };
  }
}

/**
 * Get the total count of secrets.
 */
export async function getSecretCount(): Promise<ActionResult<number>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    const count = await db.getSecretCount();
    return { success: true, data: count };
  } catch (error) {
    console.error("Failed to get secret count:", error);
    return { success: false, error: "Failed to get secret count" };
  }
}

/**
 * Batch import secrets.
 */
export async function batchImportSecrets(
  secrets: CreateSecretInput[]
): Promise<ActionResult<{ imported: number; skipped: number; duplicates: number }>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    if (!secrets || secrets.length === 0) {
      return { success: false, error: "No secrets to import" };
    }

    if (secrets.length > 100) {
      return { success: false, error: "Maximum 100 secrets per import" };
    }

    // Load existing secrets for duplicate detection (name + secret combo)
    const existing = await db.getSecrets();
    const existingKeys = new Set(
      existing.map((s) => `${s.name.toLowerCase()}::${s.secret.toLowerCase()}`)
    );

    // Track within-batch duplicates too
    const batchKeys = new Set<string>();

    let imported = 0;
    let skipped = 0;
    let duplicates = 0;

    for (const input of secrets) {
      try {
        if (!input.name || !input.secret || !validateBase32(input.secret).valid) {
          skipped++;
          continue;
        }

        const normalizedSecret = input.secret.toUpperCase().replace(/\s/g, "");
        const dedupKey = `${input.name.trim().toLowerCase()}::${normalizedSecret.toLowerCase()}`;

        // Skip if duplicate of existing secret or already in this batch
        if (existingKeys.has(dedupKey) || batchKeys.has(dedupKey)) {
          duplicates++;
          continue;
        }
        batchKeys.add(dedupKey);

        const id = `s_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

        await db.createSecret({
          id,
          name: input.name.trim(),
          account: input.account?.trim() || null,
          secret: normalizedSecret,
          type: input.type ?? OTP_DEFAULTS.type,
          digits: input.digits ?? OTP_DEFAULTS.digits,
          period: input.period ?? OTP_DEFAULTS.period,
          algorithm: input.algorithm ?? OTP_DEFAULTS.algorithm,
          counter: input.counter ?? OTP_DEFAULTS.counter,
        });
        imported++;
      } catch {
        skipped++;
      }
    }

    return { success: true, data: { imported, skipped, duplicates } };
  } catch (error) {
    console.error("Failed to batch import secrets:", error);
    return { success: false, error: "Failed to import secrets" };
  }
}
