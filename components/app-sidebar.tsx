"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Key, Archive, Wrench, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { VERSION } from "@/lib/version";
import { ThemeToggle } from "@/components/theme-toggle";
import { handleSignOut } from "@/actions/auth";

const navItems = [
  { href: "/dashboard", label: "Secrets", icon: Key },
  { href: "/dashboard/backup", label: "Backup", icon: Archive },
  { href: "/dashboard/tools", label: "Tools", icon: Wrench },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-4">
        <Shield className="h-5 w-5 text-sidebar-primary" strokeWidth={1.5} />
        <span className="font-semibold text-sidebar-foreground">neo.</span>
        <span className="ml-auto text-[10px] text-sidebar-foreground/40">
          v{VERSION}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-sidebar-border px-4 py-3">
        <ThemeToggle />
        <form action={handleSignOut}>
          <button
            type="submit"
            className="flex items-center gap-1 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors cursor-pointer"
          >
            <LogOut className="h-3 w-3" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
