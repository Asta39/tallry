import { db, payrollRuns, payrollRunLineItems, employees } from "./src/db/index.js";

async function main() {
  const runs = await db.select().from(payrollRuns);
  console.log("RUNS:", runs);

  const lines = await db.select().from(payrollRunLineItems);
  console.log("LINES:", lines.length);

  const emps = await db.select().from(employees);
  console.log("EMPS:", emps.map(e => ({ id: e.id, name: e.name, orgId: e.orgId, isActive: e.isActive, basicSalaryCents: e.basicSalaryCents })));
}
main();
