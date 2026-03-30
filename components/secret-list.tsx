/**
 * SecretList — renders a grid of SecretCards.
 * Grid layout: 8 cards per row on large screens, responsive down to 1 column.
 * Supports keyboard navigation via roving selectedIndex.
 */

import { useRef, useEffect, useState, useCallback } from "react";
import { SecretCard } from "@/components/secret-card";
import type { Secret, OtpResult } from "@/models/types";

// ── Types ────────────────────────────────────────────────────────────────

export interface SecretListProps {
  secrets: Secret[];
  otpMap: Map<string, OtpResult>;
  searchQuery?: string;
  onEdit?: (secret: Secret) => void;
  onDelete?: (id: string) => void;
  /** Index of the keyboard-selected card (null = no selection). */
  selectedIndex?: number | null;
  /** Callback when keyboard navigation changes the selected index. */
  onSelectedIndexChange?: (index: number | null) => void;
  /** Callback to return focus to the search input. */
  onFocusSearch?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────

export function SecretList({
  secrets,
  otpMap,
  searchQuery,
  onEdit,
  onDelete,
  selectedIndex,
  onSelectedIndexChange,
  onFocusSearch,
}: SecretListProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(1);

  // Track copy triggers per card index — incrementing number fires copy
  const [copyTriggers, setCopyTriggers] = useState<Record<number, number>>({});

  // ── Compute column count via ResizeObserver ────────────────────────────

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const updateColumns = () => {
      const style = window.getComputedStyle(grid);
      const cols = style.getPropertyValue("grid-template-columns").split(" ").length;
      setColumnCount(cols);
    };

    updateColumns();
    const observer = new ResizeObserver(updateColumns);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  // ── Focus grid when selectedIndex becomes non-null ─────────────────────

  useEffect(() => {
    if (selectedIndex !== null && selectedIndex !== undefined) {
      gridRef.current?.focus();
    }
  }, [selectedIndex]);

  // ── Grid keyboard handler ──────────────────────────────────────────────

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (selectedIndex === null || selectedIndex === undefined) return;
      if (!onSelectedIndexChange) return;

      const len = secrets.length;
      if (len === 0) return;

      let nextIndex: number | null = selectedIndex;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          nextIndex = Math.min(selectedIndex + columnCount, len - 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          nextIndex = selectedIndex - columnCount;
          if (nextIndex < 0) {
            // Return focus to search
            onSelectedIndexChange(null);
            onFocusSearch?.();
            return;
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (selectedIndex < len - 1) nextIndex = selectedIndex + 1;
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (selectedIndex > 0) nextIndex = selectedIndex - 1;
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          setCopyTriggers((prev) => ({
            ...prev,
            [selectedIndex]: (prev[selectedIndex] ?? 0) + 1,
          }));
          return;
        case "Escape":
          e.preventDefault();
          onSelectedIndexChange(null);
          onFocusSearch?.();
          return;
        default:
          return;
      }

      onSelectedIndexChange(nextIndex);
    },
    [selectedIndex, onSelectedIndexChange, onFocusSearch, secrets.length, columnCount],
  );

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
          ref={gridRef}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 outline-none"
          role="list"
          aria-label="Secrets list"
          tabIndex={selectedIndex !== null && selectedIndex !== undefined ? 0 : -1}
          onKeyDown={handleGridKeyDown}
        >
          {secrets.map((secret, index) => {
            const otp = otpMap.get(secret.id);
            return (
              <div
                key={secret.id}
                role="listitem"
                className="animate-fade-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <SecretCard
                  secret={secret}
                  selected={selectedIndex === index}
                  {...(copyTriggers[index] !== undefined ? { copyTrigger: copyTriggers[index] } : {})}
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
