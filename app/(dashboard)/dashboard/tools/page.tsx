import { getDashboardData } from "@/actions/dashboard";
import { ToolsView } from "@/components/tools-view";
import { DashboardProvider } from "@/contexts/dashboard-context";

export default async function ToolsPage() {
  const result = await getDashboardData();

  return (
    <DashboardProvider {...(result.success ? { initialData: result.data } : {})}>
      <ToolsView />
    </DashboardProvider>
  );
}
