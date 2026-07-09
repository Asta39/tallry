import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { PageHeader } from "@/components/ui";
import { PeriodLockForm } from "./PeriodLockForm";

export const dynamic = "force-dynamic";

export default async function PeriodLockPage() {
  await requirePerm("accountant");
  const o = await getOrg();

  return (
    <>
      <PageHeader 
        title="Lock Books" 
        subtitle="Prevent changes to the ledger before a specific date"
      />
      <div className="card max-w-lg mt-6 px-6 py-5">
        <PeriodLockForm currentLockDate={o.lockDate} />
      </div>
    </>
  );
}
