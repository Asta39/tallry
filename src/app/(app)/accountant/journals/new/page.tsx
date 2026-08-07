import { eq } from "drizzle-orm";
import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, accounts } from "@/db";
import { PageHeader } from "@/components/ui";
import { NewJournalForm } from "./NewJournalForm";

export const dynamic = "force-dynamic";

export default async function NewJournalPage() {
  await requirePerm("accountant");
  const o = await getOrg();
  const accts = await db.select().from(accounts).where(eq(accounts.orgId, o.id));

  return (
    <>
      <PageHeader
        title="Manual journal"
        subtitle="For adjustments your accountant asks for — debits must equal credits"
      />
      <NewJournalForm accounts={accts.map((a) => ({ id: a.id, code: a.code, name: a.name }))} />
    </>
  );
}
