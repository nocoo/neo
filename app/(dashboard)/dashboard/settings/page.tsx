import { getDashboardData } from "@/actions/dashboard";
import { DashboardProvider } from "@/contexts/dashboard-context";
import { SettingsView } from "@/components/settings-view";

export default async function SettingsPage() {
  const result = await getDashboardData();

  return (
    <DashboardProvider {...(result.success ? { initialData: result.data } : {})}>
      <SettingsView />
    </DashboardProvider>
  );
}
