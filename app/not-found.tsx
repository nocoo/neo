import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <h1 className="text-[18vw] leading-none font-light text-muted-foreground tracking-tight select-none">
        404
      </h1>
      <Link
        href="/"
        className="mt-6 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
      >
        Back to home
      </Link>
    </div>
  );
}
