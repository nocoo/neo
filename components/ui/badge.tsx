import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground border-border",
        destructive:
          "bg-destructive/15 text-destructive border-destructive/25",
        outline: "border-border text-foreground",
        success:
          "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/25",
        warning:
          "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/25",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
