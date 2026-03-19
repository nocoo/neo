/**
 * ALLOWED_EMAILS whitelist check — fail-closed.
 *
 * If the whitelist is empty or unset, NO ONE can sign in.
 * This is intentional — a personal 2FA vault must never be accidentally
 * open to any Google account.
 */
export function isEmailAllowed(
  email: string | null | undefined,
  allowedEmails?: string
): boolean {
  const raw = allowedEmails ?? process.env.ALLOWED_EMAILS ?? "";
  const allowed = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length === 0) return false;
  return allowed.includes(email?.toLowerCase() ?? "");
}
