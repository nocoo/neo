import { getDashboardData } from "@/actions/dashboard";
import { DashboardProvider } from "@/contexts/dashboard-context";
import { BackupView } from "@/components/backup-view";

export default async function BackupPage() {
  const result = await getDashboardData();

  return (
    <DashboardProvider {...(result.success ? { initialData: result.data } : {})}>
      <BackupView />
    </DashboardProvider>
  );
}
