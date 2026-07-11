import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, statutoryRules } from "@/db";
import { eq } from "drizzle-orm";
import { PageHeader, TableCard, Th, Td, PrimaryLink } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PayrollRulesPage() {
  await requirePerm("payroll");
  const o = await getOrg();

  const rules = await db.select().from(statutoryRules).where(eq(statutoryRules.orgId, o.id));

  return (
    <>
      <PageHeader 
        title="Statutory Rules & Tax Rates" 
        subtitle="Manage PAYE, NSSF, SHIF, and Affordable Housing Levy rates"
        action={<PrimaryLink href="/payroll/rules/new">Add New Rule</PrimaryLink>}
      />

      {rules.length === 0 ? (
        <div className="mt-8 text-center text-[var(--color-ink-500)] text-[13px]">
          No statutory rules defined. Add rules to run payroll.
        </div>
      ) : (
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Type</Th>
              <Th>Calculation Method</Th>
              <Th>Effective From</Th>
              <Th>Effective To</Th>
              <Th>Parameters</Th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="hairline-t hover:bg-[var(--color-ink-50)]/60">
                <Td className="font-medium">
                  <Link href={`/payroll/rules/${rule.id}`} className="text-[var(--color-accent-600)] hover:underline">
                    {rule.type}
                  </Link>
                </Td>
                <Td><div className="badge badge-ghost badge-sm">{rule.calculationType}</div></Td>
                <Td>{rule.effectiveFrom}</Td>
                <Td>{rule.effectiveTo || "Present"}</Td>
                <Td className="text-[11px] font-mono text-[var(--color-ink-400)] max-w-[200px]">
                  <div className="truncate w-full" title={rule.parametersJson}>
                    {rule.parametersJson}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
