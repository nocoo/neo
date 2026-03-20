"use server";

/**
 * Dashboard aggregate data fetch.
 *
 * Single action that fetches all data needed for the dashboard,
 * avoiding multiple sequential server action calls.
 */

import { getScopedDB } from "@/lib/auth-context";
import type { ActionResult, DashboardData } from "@/models/types";

/**
 * Fetch all dashboard data in a single server action.
 */
export async function getDashboardData(): Promise<ActionResult<DashboardData>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    const [secrets, settings] = await Promise.all([
      db.getSecrets(),
      db.getUserSettings(),
    ]);

    return {
      success: true,
      data: {
        secrets,
        encryptionEnabled: !!settings?.encryptionKey,
      },
    };
  } catch (error) {
    console.error("Failed to get dashboard data:", error);
    return { success: false, error: "Failed to load dashboard data" };
  }
}
