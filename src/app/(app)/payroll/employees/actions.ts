"use server";

import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, employees } from "@/db";
import { revalidatePath } from "next/cache";
import { getAccess } from "@/lib/access";
import { and, eq } from "drizzle-orm";

export async function createEmployeeAction(formData: FormData) {
  await requirePerm("payroll");
  const o = await getOrg();

  const name = formData.get("name") as string;
  const kraPin = formData.get("kraPin") as string;
  const nssfNumber = formData.get("nssfNumber") as string;
  const shifNumber = formData.get("shifNumber") as string;
  const basicSalary = parseFloat(formData.get("basicSalary") as string);
  const basicSalaryCents = Math.round(basicSalary * 100);

  if (!name?.trim()) {
    throw new Error("Employee name is required");
  }
  // parseFloat("") is NaN, and NaN < 0 is false — without this check a blank
  // salary sails past the guard and Postgres rejects "NaN" for a bigint,
  // crashing the whole page with a 500.
  if (!Number.isFinite(basicSalary) || basicSalaryCents < 0) {
    throw new Error("Enter a valid basic salary");
  }
  // Optional at add-time — a business may not have it on hand yet. Still
  // validated when given, since a malformed PIN silently breaks P9/PAYE
  // filing later with no obvious cause.
  if (kraPin?.trim() && !/^[A-Za-z]\d{9}[A-Za-z]$/.test(kraPin.trim())) {
    throw new Error("KRA PIN format looks wrong (e.g. A123456789Z) — leave it blank if you don't have it yet");
  }

  await db.insert(employees).values({
    orgId: o.id,
    name,
    kraPin: kraPin?.trim() || null,
    nssfNumber,
    shifNumber,
    basicSalaryCents,
    createdAt: new Date().toISOString(),
  });

  revalidatePath("/payroll/employees");
}

export async function updateEmployeeAction(employeeId: number, formData: FormData) {
  await requirePerm("payroll");
  const o = await getOrg();

  const name = formData.get("name") as string;
  const kraPin = formData.get("kraPin") as string;
  const nssfNumber = formData.get("nssfNumber") as string;
  const shifNumber = formData.get("shifNumber") as string;
  const basicSalary = parseFloat(formData.get("basicSalary") as string);
  const basicSalaryCents = Math.round(basicSalary * 100);

  if (!name?.trim()) {
    throw new Error("Employee name is required");
  }
  if (!Number.isFinite(basicSalary) || basicSalaryCents < 0) {
    throw new Error("Enter a valid basic salary");
  }
  if (kraPin?.trim() && !/^[A-Za-z]\d{9}[A-Za-z]$/.test(kraPin.trim())) {
    throw new Error("KRA PIN format looks wrong (e.g. A123456789Z) — leave it blank if you don't have it yet");
  }

  await db
    .update(employees)
    .set({
      name: name.trim(),
      kraPin: kraPin?.trim() || null,
      nssfNumber: nssfNumber?.trim() || null,
      shifNumber: shifNumber?.trim() || null,
      basicSalaryCents,
    })
    .where(and(eq(employees.id, employeeId), eq(employees.orgId, o.id)));

  revalidatePath(`/payroll/employees/${employeeId}`);
  revalidatePath("/payroll/employees");
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
