import { LayerCard } from "@nocoo/basalt/components/layer-card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for the Recycle Bin page.
 * Matches RecycleBinView layout: search bar + list of deleted secrets.
 */
export default function RecycleLoading() {
  return (
    <div className="space-y-6">
      {/* Search bar */}
      <Skeleton className="h-10 w-full rounded-lg" />

      {/* Deleted secrets list */}
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => i).map((i) => (
          <LayerCard key={`skeleton-${i}`} className="flex items-center gap-3">
            {/* Theme color indicator */}
            <Skeleton className="h-8 w-8 rounded-lg" />
            {/* Name + issuer */}
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            {/* Deleted date */}
            <Skeleton className="h-3 w-20" />
            {/* Action buttons */}
            <div className="flex gap-1">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </LayerCard>
        ))}
      </div>
    </div>
  );
}
