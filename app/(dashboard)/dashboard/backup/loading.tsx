import { LayerCard } from "@nocoo/basalt/components/layer-card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for the Backup page.
 * Matches BackupView layout: warning card + 3 action cards + Backy status card.
 */
export default function BackupLoading() {
  return (
    <div className="space-y-6">
      {/* Warning banner skeleton */}
      <Skeleton className="h-20 w-full rounded-lg" />

      {/* Action cards grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => i).map((i) => (
          <LayerCard key={`skeleton-${i}`} padding="lg" className="space-y-4">
            {/* Icon + title */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            {/* Button */}
            <Skeleton className="h-10 w-full rounded-lg" />
          </LayerCard>
        ))}
      </div>

      {/* Backy status card skeleton */}
      <LayerCard padding="lg" className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      </LayerCard>
    </div>
  );
}
