import { getDashboardData } from "@/actions/dashboard";
import { SettingsView } from "@/components/settings-view";
import { DashboardProvider } from "@/contexts/dashboard-context";

export default async function SettingsPage() {
  const result = await getDashboardData();

  return (
    <DashboardProvider {...(result.success ? { initialData: result.data } : {})}>
      <SettingsView />
    </DashboardProvider>
  );
}
