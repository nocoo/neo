import { Shield } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 overflow-hidden">
      {/* Top-right controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
        <ThemeToggle />
      </div>

      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse 70% 55% at 50% 50%,",
            "hsl(var(--foreground) / 0.045) 0%,",
            "hsl(var(--foreground) / 0.020) 45%,",
            "transparent 100%)",
          ].join(" "),
        }}
      />

      <div className="flex flex-col items-center">
        {/* Card */}
        <div
          className="relative w-80 overflow-hidden rounded-2xl bg-card flex flex-col ring-1 ring-black/[0.08] dark:ring-white/[0.06]"
          style={{
            boxShadow: [
              "0 1px 2px rgba(0,0,0,0.06)",
              "0 4px 8px rgba(0,0,0,0.04)",
              "0 12px 24px rgba(0,0,0,0.06)",
            ].join(", "),
          }}
        >
          {/* Header */}
          <div className="bg-primary px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield
                  className="h-4 w-4 text-primary-foreground"
                  strokeWidth={1.5}
                />
                <span className="text-sm font-semibold text-primary-foreground">
                  neo.
                </span>
              </div>
              <span className="text-[10px] font-medium uppercase tracking-widest text-primary-foreground/60">
                2FA Manager
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col items-center px-6 pt-8 pb-6">
            <p className="text-lg font-semibold text-foreground">
              Secure 2FA Manager
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sign in to manage your secrets
            </p>

            <div className="mt-5 h-px w-full bg-border" />

            <div className="mt-5 w-full">
              {/* Google Sign-in form */}
              <form
                action={async () => {
                  "use server";
                  const h = await headers();
                  const proto = h.get("x-forwarded-proto") || "http";
                  const host =
                    h.get("x-forwarded-host") ||
                    h.get("host") ||
                    "localhost:7021";
                  const redirectTo = `${proto}://${host}/dashboard`;
                  await signIn("google", { redirectTo });
                }}
              >
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-secondary px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent cursor-pointer"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </button>
              </form>
            </div>

            <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground/60">
              Secure authentication via Google OAuth
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center border-t border-border bg-secondary/50 py-2.5">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] text-muted-foreground">
                End-to-end encrypted
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
