import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, bankAccounts } from "@/db";
import { and, eq } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { DrawingsForm } from "./DrawingsForm";

export const dynamic = "force-dynamic";

export default async function DrawingsPage() {
  await requirePerm("accountant");
  const o = await getOrg();
  const banks = await db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, o.id), eq(bankAccounts.archived, false)));

  return (
    <>
      <PageHeader 
        title="Owner's Drawings" 
        subtitle="Record equity withdrawals"
      />
      <div className="card max-w-lg mt-6 px-6 py-5">
        <DrawingsForm banks={banks} />
      </div>
    </>
  );
}
