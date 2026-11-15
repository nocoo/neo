"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Sidebar as BasaltSidebar,
  SidebarProvider as BasaltSidebarProvider,
  SidebarBrand,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarIconItem,
  SidebarItem,
  SidebarNav,
  SidebarToggle,
  SidebarUser as SidebarUserRow,
} from "@nocoo/basalt";
import { useSidebar } from "@nocoo/basalt/components/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@nocoo/basalt/components/tooltip";
import { Archive, Key, Settings, Trash2, Wrench } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { handleSignOut } from "@/actions/auth";
import { TooltipProvider } from "@/components/ui/tooltip";
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

// ── Sidebar body ──

interface SidebarProps {
  user: SidebarUser;
  variant?: "desktop" | "mobile";
  onNavigate?: (() => void) | undefined;
  onDismiss?: (() => void) | undefined;
}

function SidebarBody({
  user,
  onNavigate,
  onDismiss,
}: {
  user: SidebarUser;
  onNavigate?: (() => void) | undefined;
  onDismiss?: (() => void) | undefined;
}) {
  const pathname = usePathname();
  const { collapsed, peek, peeking } = useSidebar();
  const railCollapsed = collapsed && !(peek && peeking);

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
      <AvatarFallback className="bg-basalt-accent text-xs font-medium text-basalt-accent-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <>
      <SidebarHeader>
        <SidebarBrand
          logo={<Image src="/logo-24.png" alt="Neo" width={24} height={24} />}
          name="neo."
          version={`v${VERSION}`}
          action={
            onDismiss ? <SidebarToggle mode="dismiss" onDismiss={onDismiss} /> : <SidebarToggle />
          }
        />
      </SidebarHeader>

      <SidebarNav aria-label="Main navigation">
        {railCollapsed
          ? ALL_NAV_ITEMS.map((item) => (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>
                  <SidebarIconItem
                    href={item.href}
                    active={isActive(item.href)}
                    aria-label={item.label}
                    onClick={onNavigate}
                  >
                    <item.icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
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
                    href={item.href}
                    active={isActive(item.href)}
                    onClick={onNavigate}
                  >
                    <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                    <span className="flex-1 truncate text-left">{item.label}</span>
                  </SidebarItem>
                ))}
              </SidebarGroup>
            ))}
      </SidebarNav>

      <SidebarFooter>
        <SidebarUserRow
          name={user.name ?? "User"}
          email={user.email ?? undefined}
          avatar={userAvatar}
          tooltip={user.name ?? "User"}
          onSignOut={handleSignOut}
        />
      </SidebarFooter>
    </>
  );
}

// ── Main sidebar component ──

export function Sidebar({ user, variant = "desktop", onNavigate, onDismiss }: SidebarProps) {
  const isMobile = variant === "mobile";
  return (
    <TooltipProvider delayDuration={0}>
      <BasaltSidebar
        aria-label={isMobile ? "Main navigation drawer" : "Main navigation"}
        resizable={false}
      >
        <SidebarBody
          user={user}
          onNavigate={onNavigate}
          onDismiss={isMobile ? onDismiss : undefined}
        />
      </BasaltSidebar>
    </TooltipProvider>
  );
}

export { BasaltSidebarProvider as SidebarProvider };
