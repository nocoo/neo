"use client";

import { AppHeader } from "@nocoo/basalt/components/app-header";
import {
  AppMain,
  AppSkipLink,
  AppShell as BasaltAppShell,
} from "@nocoo/basalt/components/app-shell";
import { ContentIsland } from "@nocoo/basalt/components/sidebar";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import type { BreadcrumbItem } from "@/components/breadcrumbs";
import { Github } from "@/components/icons/github";
import type { SidebarUser } from "@/components/sidebar";
import { Sidebar } from "@/components/sidebar";
import { SidebarProvider, useSidebar } from "@/components/sidebar-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

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
  return [{ label: "Home", href: "/dashboard" }, { label: title }];
}

function AppShellInner({ children, user }: { children: React.ReactNode; user: SidebarUser }) {
  const { isMobile, mobileOpen, toggle, setMobileOpen } = useSidebar();
  const breadcrumbs = usePageBreadcrumbs();

  const leadingAction = isMobile ? (
    <button
      type="button"
      onClick={toggle}
      aria-label="Open menu"
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      <Menu className="h-5 w-5" strokeWidth={1.5} />
    </button>
  ) : null;

  const headerActions = (
    <>
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
    </>
  );

  return (
    <BasaltAppShell>
      <AppSkipLink />

      {/* Desktop sidebar */}
      {!isMobile && <Sidebar user={user} />}

      {/* Mobile overlay + sidebar */}
      {isMobile && mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Close sidebar overlay"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[260px]">
            <Sidebar user={user} />
          </div>
        </>
      )}

      <AppMain>
        <AppHeader leading={leadingAction} breadcrumbs={breadcrumbs} actions={headerActions} />

        {/* Content panel */}
        <div className={cn("flex-1 min-h-0 px-2 pb-2 md:px-3 md:pb-3 flex flex-col")}>
          <ContentIsland>{children}</ContentIsland>
        </div>
      </AppMain>
    </BasaltAppShell>
  );
}

export function AppShell({ children, user }: { children: React.ReactNode; user: SidebarUser }) {
  return (
    <SidebarProvider>
      <AppShellInner user={user}>{children}</AppShellInner>
    </SidebarProvider>
  );
}
