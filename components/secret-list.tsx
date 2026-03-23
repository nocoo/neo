/**
 * SecretList — renders a grid of SecretCards.
 * Grid layout: 8 cards per row on large screens, responsive down to 1 column.
 */

import { SecretCard } from "@/components/secret-card";
import type { Secret, OtpResult } from "@/models/types";

// ── Types ────────────────────────────────────────────────────────────────

export interface SecretListProps {
  secrets: Secret[];
  otpMap: Map<string, OtpResult>;
  searchQuery?: string;
  onEdit?: (secret: Secret) => void;
  onDelete?: (id: string) => void;
}

// ── Component ────────────────────────────────────────────────────────────

export function SecretList({
  secrets,
  otpMap,
  searchQuery,
  onEdit,
  onDelete,
}: SecretListProps) {
  return (
    <div>
      {/* Grid */}
      {secrets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {searchQuery
              ? "No secrets match your search."
              : "No secrets yet. Add your first secret to get started."}
          </p>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3"
          role="list"
          aria-label="Secrets list"
        >
          {secrets.map((secret) => {
            const otp = otpMap.get(secret.id);
            return (
              <div key={secret.id} role="listitem">
                <SecretCard
                  secret={secret}
                  {...(otp ? { otp } : {})}
                  {...(onEdit ? { onEdit } : {})}
                  {...(onDelete ? { onDelete } : {})}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
