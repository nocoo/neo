"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/breadcrumbs";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, useSidebar } from "@/components/sidebar-context";
import { Menu, Github } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SidebarUser } from "@/components/sidebar";

export type { SidebarUser };

/** Route-to-title mapping for the dashboard header */
const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Secrets",
  "/dashboard/recycle": "Recycle Bin",
  "/dashboard/backup": "Backup",
  "/dashboard/tools": "Tools",
  "/dashboard/settings": "Settings",
};

function usePageBreadcrumbs(): BreadcrumbItem[] {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "Secrets";

  // Root dashboard page — single breadcrumb
  if (pathname === "/dashboard") {
    return [{ label: title }];
  }

  // Sub-pages — Home → Current
  return [
    { label: "Home", href: "/dashboard" },
    { label: title },
  ];
}

function AppShellInner({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SidebarUser;
}) {
  const { isMobile, mobileOpen, toggle, setMobileOpen } = useSidebar();
  const breadcrumbs = usePageBreadcrumbs();

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      {!isMobile && <Sidebar user={user} />}

      {/* Mobile overlay + sidebar */}
      {isMobile && mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[260px]">
            <Sidebar user={user} />
          </div>
        </>
      )}

      <main className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Header */}
        <header className="flex h-14 items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={toggle}
                aria-label="Open menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Menu className="h-5 w-5" strokeWidth={1.5} />
              </button>
            )}
            <Breadcrumbs items={breadcrumbs} />
          </div>
          <div className="flex items-center gap-1">
            <a
              href="https://github.com/nocoo/neo"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="GitHub repository"
            >
              <Github className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </a>
            <ThemeToggle />
          </div>
        </header>

        {/* Content panel */}
        <div className={cn("flex-1 px-2 pb-2 md:px-3 md:pb-3")}>
          <div className="h-full rounded-[16px] md:rounded-[20px] bg-card p-3 md:p-5 overflow-y-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SidebarUser;
}) {
  return (
    <SidebarProvider>
      <AppShellInner user={user}>{children}</AppShellInner>
    </SidebarProvider>
  );
}
