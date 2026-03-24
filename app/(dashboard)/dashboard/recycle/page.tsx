import { getDeletedSecrets } from "@/actions/secrets";
import { RecycleBinView } from "@/components/recycle-bin-view";

export default async function RecycleBinPage() {
  const result = await getDeletedSecrets();

  return (
    <RecycleBinView initialSecrets={result.success ? result.data : []} />
  );
}
