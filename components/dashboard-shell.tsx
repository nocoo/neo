import { AppSidebar } from "@/components/app-sidebar";

export interface SidebarUser {
  name: string | null;
  email: string | null;
  image: string | null;
}

export function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SidebarUser;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar user={user} />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
