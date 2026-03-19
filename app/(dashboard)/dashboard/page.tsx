import { getDashboardData } from "@/actions/dashboard";
import { DashboardProvider } from "@/contexts/dashboard-context";
import { SecretsView } from "@/components/secrets-view";

export default async function DashboardPage() {
  const result = await getDashboardData();
  const initialData = result.success ? result.data : undefined;

  return (
    <DashboardProvider initialData={initialData}>
      <SecretsView />
    </DashboardProvider>
  );
}
