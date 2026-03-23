import { getDashboardData } from "@/actions/dashboard";
import { DashboardProvider } from "@/contexts/dashboard-context";
import { SecretsView } from "@/components/secrets-view";

export default async function DashboardPage() {
  const result = await getDashboardData();

  return (
    <DashboardProvider {...(result.success ? { initialData: result.data } : {})}>
      <SecretsView />
    </DashboardProvider>
  );
}
