import { requirePerm } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { EmployeeForm } from "./EmployeeForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  await requirePerm("payroll");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <PageHeader
            title="Add New Employee"
            subtitle="Register a staff member to process monthly payroll and statutory deductions"
          />
        </div>
        <Link
          href="/payroll/employees"
          className="px-3.5 py-1.5 text-xs font-medium text-[var(--color-ink-600)] bg-white hover:bg-[var(--color-ink-50)] border border-[var(--color-ink-200)] rounded-lg transition-colors shadow-xs"
        >
          ← Back to Employees
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--color-ink-200)] p-6 sm:p-8 shadow-xs">
        <EmployeeForm />
      </div>
    </div>
  );
}
