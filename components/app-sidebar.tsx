"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Key, Archive, Wrench, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { VERSION } from "@/lib/version";
import { handleSignOut } from "@/actions/auth";
import type { SidebarUser } from "@/components/dashboard-shell";

const navItems = [
  { href: "/dashboard", label: "Secrets", icon: Key },
  { href: "/dashboard/backup", label: "Backup", icon: Archive },
  { href: "/dashboard/tools", label: "Tools", icon: Wrench },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

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

      {/* Footer — user info + sign-out */}
      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Avatar */}
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? "User"}
              className="h-9 w-9 shrink-0 rounded-full"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
              {initials}
            </div>
          )}

          {/* User info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user.name ?? "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user.email ?? ""}
            </p>
          </div>

          {/* Sign out */}
          <form action={handleSignOut}>
            <button
              type="submit"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
