import { getDashboardData } from "@/actions/dashboard";
import { DashboardProvider } from "@/contexts/dashboard-context";
import { ToolsView } from "@/components/tools-view";

export default async function ToolsPage() {
  const result = await getDashboardData();
  const initialData = result.success ? result.data : undefined;

  return (
    <DashboardProvider initialData={initialData}>
      <ToolsView />
    </DashboardProvider>
  );
}
