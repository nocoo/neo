"use client";

import {
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarIconItem,
  SidebarItem,
  SidebarNav,
  SidebarUser as SidebarUserRow,
} from "@nocoo/basalt/components/sidebar";
import { Archive, Key, LogOut, PanelLeft, Settings, Trash2, Wrench } from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { handleSignOut } from "@/actions/auth";
import { useSidebar } from "@/components/sidebar-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VERSION } from "@/lib/version";

// ── Navigation data model ──

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Secret",
    items: [
      { href: "/dashboard", label: "Secrets", icon: Key },
      { href: "/dashboard/recycle", label: "Recycle Bin", icon: Trash2 },
    ],
  },
  {
    label: "Backup",
    items: [{ href: "/dashboard/backup", label: "Backup", icon: Archive }],
  },
  {
    label: "Settings",
    items: [
      { href: "/dashboard/tools", label: "Tools", icon: Wrench },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export interface SidebarUser {
  name: string | null;
  email: string | null;
  image: string | null;
}

// ── Main sidebar component ──

export function Sidebar({ user }: { user: SidebarUser }) {
  const { collapsed, toggle } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  function isActive(href: string): boolean {
    return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  }

  const userAvatar = (
    <Avatar className="h-9 w-9">
      {user.image && <AvatarImage src={user.image} alt={user.name ?? "User"} />}
      <AvatarFallback className="bg-accent text-xs font-medium text-accent-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  );

  const signOut = (
    <form action={handleSignOut}>
      <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" title="Sign out">
        <LogOut className="h-4 w-4" strokeWidth={1.5} />
      </Button>
    </form>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        data-basalt-sidebar=""
        data-collapsed={collapsed ? "true" : "false"}
        className={`safe-area-sidebar sticky top-0 flex h-full shrink-0 flex-col bg-background overflow-hidden transition-[width] duration-300 ease-in-out ${
          collapsed ? "w-[68px]" : "w-[260px]"
        }`}
      >
        <SidebarHeader>
          {collapsed ? (
            <Image
              src="/logo-24.png"
              alt="Neo"
              width={24}
              height={24}
              className="h-6 w-6 shrink-0"
            />
          ) : (
            <div className="flex w-full min-w-0 items-center justify-between">
              <div className="flex min-w-0 items-center gap-basalt-space-lg">
                <Image
                  src="/logo-24.png"
                  alt="Neo"
                  width={24}
                  height={24}
                  className="h-6 w-6 shrink-0"
                />
                <span className="truncate text-lg font-semibold text-foreground">neo.</span>
                <span className="shrink-0 rounded-md bg-secondary px-basalt-space-md py-basalt-space-xs font-mono text-[10px] leading-none font-medium text-muted-foreground">
                  v{VERSION}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={toggle}
                aria-label="Collapse sidebar"
              >
                <PanelLeft className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>
          )}
        </SidebarHeader>

        {collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="mb-basalt-space-sm self-center"
            onClick={toggle}
            aria-label="Expand sidebar"
          >
            <PanelLeft className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        )}

        <SidebarNav aria-label="Main navigation">
          {collapsed
            ? ALL_NAV_ITEMS.map((item) => (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <SidebarIconItem
                      active={isActive(item.href)}
                      aria-label={item.label}
                      onClick={() => router.push(item.href)}
                    >
                      <item.icon className="h-4 w-4" strokeWidth={1.5} />
                    </SidebarIconItem>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              ))
            : NAV_GROUPS.map((group) => (
                <SidebarGroup key={group.label} label={group.label} defaultOpen>
                  {group.items.map((item) => (
                    <SidebarItem
                      key={item.href}
                      active={isActive(item.href)}
                      onClick={() => router.push(item.href)}
                    >
                      <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                      <span className="flex-1 truncate text-left">{item.label}</span>
                    </SidebarItem>
                  ))}
                </SidebarGroup>
              ))}
        </SidebarNav>

        <SidebarFooter>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex self-center">{userAvatar}</span>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {user.email ?? user.name ?? "User"}
              </TooltipContent>
            </Tooltip>
          ) : (
            <SidebarUserRow
              name={user.name ?? "User"}
              email={user.email ?? ""}
              avatar={userAvatar}
              action={signOut}
            />
          )}
        </SidebarFooter>
      </aside>
    </TooltipProvider>
  );
}
