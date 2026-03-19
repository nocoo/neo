import { getDashboardData } from "@/actions/dashboard";
import { DashboardProvider } from "@/contexts/dashboard-context";
import { BackupView } from "@/components/backup-view";

export default async function BackupPage() {
  const result = await getDashboardData();
  const initialData = result.success ? result.data : undefined;

  return (
    <DashboardProvider initialData={initialData}>
      <BackupView />
    </DashboardProvider>
  );
}
