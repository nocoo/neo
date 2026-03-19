import { DashboardShell } from "@/components/dashboard-shell";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
