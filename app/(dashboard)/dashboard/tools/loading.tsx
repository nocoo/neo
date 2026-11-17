import { LayerCard } from "@nocoo/basalt/components/layer-card";
import { Skeleton } from "@/components/skeleton";

/**
 * Loading skeleton for the Tools page.
 * Matches ToolsView layout: 3 tool cards in a grid.
 */
export default function ToolsLoading() {
  return (
    <div className="space-y-6">
      {/* Tool cards grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => i).map((i) => (
          <LayerCard key={`skeleton-${i}`} padding="lg" className="space-y-3">
            {/* Icon + title */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-20" />
            </div>
            {/* Description */}
            <Skeleton className="h-4 w-full" />
            {/* Button */}
            <Skeleton className="h-10 w-full rounded-lg" />
          </LayerCard>
        ))}
      </div>
    </div>
  );
}
