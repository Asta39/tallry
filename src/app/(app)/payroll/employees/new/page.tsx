import { requirePerm } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { createEmployeeAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  await requirePerm("accountant");

  return (
    <>
      <PageHeader 
        title="Add Employee" 
        subtitle="Register a new staff member for payroll"
        backLink="/payroll/employees"
      />
      <div className="card max-w-2xl mt-6">
        <form action={createEmployeeAction} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Full Name</label>
              <input name="name" type="text" className="input input-bordered w-full" required placeholder="e.g. Jane Doe" />
            </div>

            <div>
              <label className="label">Basic Salary (KES / month)</label>
              <input name="basicSalary" type="number" step="0.01" min="0" className="input input-bordered w-full" required placeholder="0.00" />
            </div>
            
            <div className="col-span-2 divider mb-0">Statutory Details</div>

            <div>
              <label className="label">KRA PIN</label>
              <input name="kraPin" type="text" className="input input-bordered w-full" placeholder="e.g. A000000000Z" />
            </div>

            <div>
              <label className="label">NSSF Number</label>
              <input name="nssfNumber" type="text" className="input input-bordered w-full" placeholder="Optional" />
            </div>

            <div>
              <label className="label">SHIF Number</label>
              <input name="shifNumber" type="text" className="input input-bordered w-full" placeholder="Optional" />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button type="submit" className="btn btn-primary">Add Employee</button>
          </div>
        </form>
      </div>
    </>
  );
}
