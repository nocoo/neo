import { cn } from "@/lib/utils";

export { SkeletonLine } from "@nocoo/basalt/components/skeleton-line";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}
