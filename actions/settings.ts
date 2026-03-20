"use server";

/**
 * Settings Server Actions.
 *
 * All actions return ActionResult<T> — never throw.
 */

import { getScopedDB } from "@/lib/auth-context";
import { generateEncryptionKey } from "@/models/encryption";
import type { ActionResult, UserSettings } from "@/models/types";

/**
 * Get user settings.
 */
export async function getUserSettings(): Promise<ActionResult<UserSettings | null>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    const settings = await db.getUserSettings();
    return { success: true, data: settings };
  } catch (error) {
    console.error("Failed to get user settings:", error);
    return { success: false, error: "Failed to load settings" };
  }
}

/**
 * Update user settings (upsert).
 */
export async function updateUserSettings(input: {
  theme?: string;
  language?: string;
  encryptionKeyHash?: string | null;
}): Promise<ActionResult<UserSettings>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    // Validate theme
    if (input.theme !== undefined) {
      const validThemes = ["light", "dark", "system"];
      if (!validThemes.includes(input.theme)) {
        return { success: false, error: `Invalid theme: must be one of ${validThemes.join(", ")}` };
      }
    }

    // Validate language
    if (input.language !== undefined) {
      const validLanguages = ["en", "zh"];
      if (!validLanguages.includes(input.language)) {
        return { success: false, error: `Invalid language: must be one of ${validLanguages.join(", ")}` };
      }
    }

    const settings = await db.upsertUserSettings(input);
    return { success: true, data: settings };
  } catch (error) {
    console.error("Failed to update user settings:", error);
    return { success: false, error: "Failed to update settings" };
  }
}

// ── Encryption Key Management ─────────────────────────────────────────────

/**
 * Get the current encryption key.
 * Returns the actual key (not hash) for display/copy purposes.
 */
export async function getEncryptionKey(): Promise<ActionResult<string | null>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    const key = await db.getEncryptionKey();
    return { success: true, data: key };
  } catch (error) {
    console.error("Failed to get encryption key:", error);
    return { success: false, error: "Failed to load encryption key" };
  }
}

/**
 * Generate a new encryption key and save it.
 * This replaces any existing key — the user must save the old key externally first.
 */
export async function generateAndSaveEncryptionKey(): Promise<ActionResult<string>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    const key = await generateEncryptionKey();
    await db.setEncryptionKey(key);
    return { success: true, data: key };
  } catch (error) {
    console.error("Failed to generate encryption key:", error);
    return { success: false, error: "Failed to generate encryption key" };
  }
}
