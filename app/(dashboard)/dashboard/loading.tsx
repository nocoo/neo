import { LayerCard } from "@nocoo/basalt/components/layer-card";
import { Skeleton } from "@/components/skeleton";

/**
 * Loading skeleton for the Secrets page.
 * Matches SecretsView layout: search bar + action buttons + card grid.
 */
export default function SecretsLoading() {
  return (
    <div className="space-y-6">
      {/* Search + actions */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>

      {/* Secret card grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {Array.from({ length: 12 }, (_, i) => i).map((i) => (
          <LayerCard key={`skeleton-${i}`} padding="lg" className="space-y-3">
            {/* Issuer row */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            {/* OTP code */}
            <Skeleton className="h-8 w-32" />
            {/* Progress bar */}
            <Skeleton className="h-1.5 w-full rounded-full" />
          </LayerCard>
        ))}
      </div>
    </div>
  );
}
