import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, statutoryRules } from "@/db";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/ui";

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
        action={<button className="btn btn-primary btn-sm">Add New Rule</button>}
      />

      <div className="card bg-base-100 shadow-sm mt-6">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Calculation Method</th>
                <th>Effective From</th>
                <th>Effective To</th>
                <th>Parameters</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td className="font-medium">{rule.type}</td>
                  <td><div className="badge badge-ghost">{rule.calculationType}</div></td>
                  <td>{rule.effectiveFrom}</td>
                  <td>{rule.effectiveTo || "Present"}</td>
                  <td className="text-xs font-mono text-base-content/60 truncate max-w-xs" title={rule.parametersJson}>
                    {rule.parametersJson}
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-base-content/60">
                    No statutory rules defined. Add rules to run payroll.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
