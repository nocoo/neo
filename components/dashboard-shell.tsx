"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useDashboardLayoutViewModel } from "@/viewmodels/useDashboardLayoutViewModel";
import { Menu, Github } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SidebarUser } from "@/components/app-sidebar";

export type { SidebarUser };

/** Route-to-title mapping for the dashboard header */
const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Secrets",
  "/dashboard/backup": "Backup",
  "/dashboard/tools": "Tools",
  "/dashboard/settings": "Settings",
};

function usePageTitle(): string {
  const pathname = usePathname();
  return PAGE_TITLES[pathname] ?? "Secrets";
}

export function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SidebarUser;
}) {
  const { collapsed, isMobile, mobileOpen, toggleSidebar, closeMobileSidebar } =
    useDashboardLayoutViewModel();
  const pageTitle = usePageTitle();

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      {!isMobile && (
        <AppSidebar
          collapsed={collapsed}
          onToggle={toggleSidebar}
          user={user}
        />
      )}

      {/* Mobile overlay + sidebar */}
      {isMobile && mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs"
            onClick={closeMobileSidebar}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[260px]">
            <AppSidebar
              collapsed={false}
              onToggle={closeMobileSidebar}
              user={user}
            />
          </div>
        </>
      )}

      <main className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Header */}
        <header className="flex h-14 items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={toggleSidebar}
                aria-label="Open menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Menu className="h-5 w-5" strokeWidth={1.5} />
              </button>
            )}
            <h1 className="text-lg md:text-xl font-semibold text-foreground">
              {pageTitle}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <a
              href="https://github.com/nocoo/neo"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="GitHub"
            >
              <Github className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </a>
            <ThemeToggle />
          </div>
        </header>

        {/* Content panel — rounded island */}
        <div className={cn("flex-1 px-2 pb-2 md:px-3 md:pb-3")}>
          <div className="h-full rounded-island bg-card p-3 md:p-5 overflow-y-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
