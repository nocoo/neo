"use client";

import { useCallback, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

/** ViewModel for the dashboard layout — manages the mobile navigation drawer.
 * Desktop rail collapse is owned by the Basalt SidebarProvider. */
export function useDashboardLayoutViewModel() {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobileSidebar = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return {
    isMobile,
    mobileOpen,
    setMobileOpen,
    closeMobileSidebar,
  };
}
