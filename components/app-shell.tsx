"use client";

import { SidebarDrawer } from "@nocoo/basalt";
import { AppHeader, AppHeaderMenuButton, ProjectLinks } from "@nocoo/basalt/components/app-header";
import {
  AppMain,
  AppSkipLink,
  AppShell as BasaltAppShell,
} from "@nocoo/basalt/components/app-shell";
import { ContentIsland } from "@nocoo/basalt/components/sidebar";
import { TooltipProvider } from "@nocoo/basalt/components/tooltip";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef } from "react";
import type { BreadcrumbItem } from "@/components/breadcrumbs";
import { Sidebar, SidebarProvider, type SidebarUser } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useDashboardLayoutViewModel } from "@/viewmodels/useDashboardLayoutViewModel";

export type { SidebarUser };

/** Route-to-title mapping for the dashboard header */
const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Secrets",
  "/dashboard/recycle": "Recycle Bin",
  "/dashboard/backup": "Backup",
  "/dashboard/tools": "Tools",
  "/dashboard/settings": "Settings",
};

function usePageNav(): { breadcrumbs?: BreadcrumbItem[]; title: string } {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "Secrets";

  // Root dashboard page — no parent breadcrumbs, title is the page title
  if (pathname === "/dashboard") {
    return { title };
  }

  // Sub-pages — Home parent breadcrumb + Current page title
  return {
    breadcrumbs: [{ label: "Home", href: "/dashboard" }],
    title,
  };
}

function AppShellInner({ children, user }: { children: React.ReactNode; user: SidebarUser }) {
  const { isMobile, mobileOpen, setMobileOpen, closeMobileSidebar } = useDashboardLayoutViewModel();
  const { breadcrumbs, title } = usePageNav();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerId = useId();
  const pathname = usePathname();

  // Close the drawer on route change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname triggers close on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile, setMobileOpen]);

  return (
    <TooltipProvider delayDuration={0}>
      <BasaltAppShell>
        <AppSkipLink>Skip to main content</AppSkipLink>

        {/* Desktop sidebar */}
        {!isMobile && (
          <SidebarProvider>
            <Sidebar user={user} />
          </SidebarProvider>
        )}

        {/* Mobile drawer */}
        {isMobile && (
          <SidebarDrawer
            id={drawerId}
            open={mobileOpen}
            onOpenChange={setMobileOpen}
            returnFocusRef={menuButtonRef}
            title="Navigation"
          >
            <Sidebar
              user={user}
              variant="mobile"
              onNavigate={closeMobileSidebar}
              onDismiss={closeMobileSidebar}
            />
          </SidebarDrawer>
        )}

        <AppMain>
          <AppHeader
            leading={
              isMobile ? (
                <AppHeaderMenuButton
                  ref={menuButtonRef}
                  aria-controls={drawerId}
                  aria-expanded={mobileOpen}
                  onClick={() => setMobileOpen(true)}
                />
              ) : null
            }
            {...(breadcrumbs ? { breadcrumbs } : {})}
            title={title}
            actions={
              <>
                <ProjectLinks github="nocoo/neo" hexly="neo" name="Neo" />
                <ThemeToggle />
              </>
            }
          />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col px-basalt-space-lg pb-basalt-space-lg md:px-basalt-layout-sm md:pb-basalt-layout-sm">
            <ContentIsland>{children}</ContentIsland>
          </div>
        </AppMain>
      </BasaltAppShell>
    </TooltipProvider>
  );
}

export function AppShell({ children, user }: { children: React.ReactNode; user: SidebarUser }) {
  return <AppShellInner user={user}>{children}</AppShellInner>;
}
