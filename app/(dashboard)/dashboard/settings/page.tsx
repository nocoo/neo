import { getDashboardData } from "@/actions/dashboard";
import { DashboardProvider } from "@/contexts/dashboard-context";
import { SettingsView } from "@/components/settings-view";

export default async function SettingsPage() {
  const result = await getDashboardData();
  const initialData = result.success ? result.data : undefined;

  return (
    <DashboardProvider initialData={initialData}>
      <SettingsView />
    </DashboardProvider>
  );
}
