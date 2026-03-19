"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  Key,
  Archive,
  Wrench,
  Settings,
  LogOut,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VERSION } from "@/lib/version";
import { handleSignOut } from "@/actions/auth";

const navItems = [
  { href: "/dashboard", label: "Secrets", icon: Key },
  { href: "/dashboard/backup", label: "Backup", icon: Archive },
  { href: "/dashboard/tools", label: "Tools", icon: Wrench },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export interface SidebarUser {
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  user: SidebarUser;
}

export function AppSidebar({ collapsed, onToggle, user }: AppSidebarProps) {
  const pathname = usePathname();

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  function isActive(href: string): boolean {
    return href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);
  }

  // ── Collapsed mode (68px, icons only) ────────────────────────────────
  if (collapsed) {
    return (
      <aside className="sticky top-0 flex h-screen w-[68px] shrink-0 flex-col items-center bg-background transition-all duration-150 ease-in-out overflow-hidden">
        {/* Logo */}
        <div className="flex h-14 items-center justify-center">
          <Shield className="h-5 w-5 text-primary" strokeWidth={1.5} />
        </div>

        {/* Toggle */}
        <button
          onClick={onToggle}
          aria-label="Expand sidebar"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-2"
        >
          <PanelLeft className="h-4 w-4" strokeWidth={1.5} />
        </button>

        {/* Nav — icon only */}
        <nav className="flex-1 flex flex-col items-center gap-1 overflow-y-auto pt-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                isActive(item.href)
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" strokeWidth={1.5} />
            </Link>
          ))}
        </nav>

        {/* User avatar */}
        <div className="py-3 flex justify-center w-full">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? "User"}
              className="h-9 w-9 shrink-0 rounded-full"
            />
          ) : (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground"
              title={user.name ?? "User"}
            >
              {initials}
            </div>
          )}
        </div>
      </aside>
    );
  }

  // ── Expanded mode (260px, full content) ──────────────────────────────
  return (
    <aside className="sticky top-0 flex h-screen w-[260px] shrink-0 flex-col bg-background transition-all duration-150 ease-in-out overflow-hidden">
      {/* Header */}
      <div className="px-3 h-14 flex items-center">
        <div className="flex w-full items-center justify-between px-3">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <span className="text-lg font-semibold text-foreground">neo.</span>
            <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground leading-none">
              v{VERSION}
            </span>
          </div>
          <button
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <PanelLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto pt-2">
        <div className="px-3 mb-1">
          <div className="flex flex-col gap-0.5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal transition-colors",
                  isActive(item.href)
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="flex-1 text-left">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* User section */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? "User"}
              className="h-9 w-9 shrink-0 rounded-full"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user.name ?? "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user.email ?? ""}
            </p>
          </div>
          <form action={handleSignOut}>
            <button
              type="submit"
              aria-label="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 cursor-pointer"
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
