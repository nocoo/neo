"use client";

/**
 * SecretList — renders a filterable grid of SecretCards with a search bar.
 * Grid layout: 8 cards per row on large screens, responsive down to 1 column.
 */

import { Search } from "lucide-react";
import { SecretCard } from "@/components/secret-card";
import type { Secret, OtpResult } from "@/models/types";

// ── Types ────────────────────────────────────────────────────────────────

export interface SecretListProps {
  secrets: Secret[];
  otpMap: Map<string, OtpResult>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onEdit?: (secret: Secret) => void;
  onDelete?: (id: string) => void;
}

// ── Component ────────────────────────────────────────────────────────────

export function SecretList({
  secrets,
  otpMap,
  searchQuery,
  onSearchChange,
  onEdit,
  onDelete,
}: SecretListProps) {
  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search secrets..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Search secrets"
        />
      </div>

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
          {secrets.map((secret) => (
            <div key={secret.id} role="listitem">
              <SecretCard
                secret={secret}
                otp={otpMap.get(secret.id)}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
