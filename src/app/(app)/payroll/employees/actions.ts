"use server";

import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, employees } from "@/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
