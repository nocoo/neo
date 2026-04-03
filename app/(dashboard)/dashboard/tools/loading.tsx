import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for the Tools page.
 * Matches ToolsView layout: 3 tool cards in a grid.
 */
export default function ToolsLoading() {
  return (
    <div className="space-y-6">
      {/* Tool cards grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-card bg-secondary p-6 space-y-3"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            {/* Icon + title */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-20" />
            </div>
            {/* Description */}
            <Skeleton className="h-4 w-full" />
            {/* Button */}
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
