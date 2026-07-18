import { getDashboardData } from "@/actions/dashboard";
import { BackupView } from "@/components/backup-view";
import { DashboardProvider } from "@/contexts/dashboard-context";

export default async function BackupPage() {
  const result = await getDashboardData();

  return (
    <DashboardProvider {...(result.success ? { initialData: result.data } : {})}>
      <BackupView />
    </DashboardProvider>
  );
}
