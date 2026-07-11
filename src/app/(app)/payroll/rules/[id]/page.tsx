import { db, statutoryRules } from "@/db";
import { and, eq } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { RuleForm } from "../new/RuleForm";

export default async function RuleDetailPage(props: { params: Promise<{ id: string }> }) {
  await requirePerm("accountant");
  const o = await getOrg();
  const params = await props.params;

  const [rule] = await db
    .select()
    .from(statutoryRules)
    .where(and(eq(statutoryRules.id, Number(params.id)), eq(statutoryRules.orgId, o.id)))
    .limit(1);

  if (!rule) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader 
        title={`Edit Rule: ${rule.type}`} 
        backLink="/payroll/rules"
        description="Update statutory parameters for payroll calculations."
      />

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        <RuleForm initialData={rule} />
      </div>
    </div>
  );
}
