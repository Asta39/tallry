"use server";

import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, employees } from "@/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { and, eq } from "drizzle-orm";

export async function createEmployeeAction(formData: FormData) {
  await requirePerm("accountant");
  const o = await getOrg();

  const name = formData.get("name") as string;
  const kraPin = formData.get("kraPin") as string;
  const nssfNumber = formData.get("nssfNumber") as string;
  const shifNumber = formData.get("shifNumber") as string;
  const basicSalaryCents = Math.round(parseFloat(formData.get("basicSalary") as string) * 100);

  if (!name || basicSalaryCents < 0) {
    throw new Error("Missing or invalid required fields");
  }
  // KRA PIN is required for PAYE remittance filing on iTax — without it payroll can run
  // but the org won't be able to file correctly for this employee.
  if (!kraPin || !/^[A-Za-z]\d{9}[A-Za-z]$/.test(kraPin.trim())) {
    throw new Error("A valid KRA PIN is required (e.g. A123456789Z)");
  }

  await db.insert(employees).values({
    orgId: o.id,
    name,
    kraPin,
    nssfNumber,
    shifNumber,
    basicSalaryCents,
    createdAt: new Date().toISOString(),
  });

  revalidatePath("/payroll/employees");
  redirect("/payroll/employees");
}

export async function toggleEmployeeStatusAction(employeeId: number, isActive: boolean) {
  const access = await getAccess();
  if (!access || access.role !== "admin") {
    throw new Error("Only admins can suspend or activate employees");
  }

  await db.update(employees)
    .set({ isActive })
    .where(and(eq(employees.id, employeeId), eq(employees.orgId, access.orgId)));

  revalidatePath("/payroll/employees");
}
