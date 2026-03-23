import { getDashboardData } from "@/actions/dashboard";
import { DashboardProvider } from "@/contexts/dashboard-context";
import { ToolsView } from "@/components/tools-view";

export default async function ToolsPage() {
  const result = await getDashboardData();

  return (
    <DashboardProvider {...(result.success ? { initialData: result.data } : {})}>
      <ToolsView />
    </DashboardProvider>
  );
}
