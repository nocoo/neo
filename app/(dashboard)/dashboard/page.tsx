import { getDashboardData } from "@/actions/dashboard";
import { SecretsView } from "@/components/secrets-view";
import { DashboardProvider } from "@/contexts/dashboard-context";

export default async function DashboardPage() {
  const result = await getDashboardData();

  return (
    <DashboardProvider {...(result.success ? { initialData: result.data } : {})}>
      <SecretsView />
    </DashboardProvider>
  );
}
