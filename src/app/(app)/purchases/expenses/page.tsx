import { DocList } from "@/components/DocList";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  await requirePerm("expenses");
  return (
    <DocList
      type="expense"
      title="Expenses"
      subtitle="Money spent and paid on the spot"
      basePath="/purchases/expenses"
      newLabel="+ New expense"
      emptyTitle="No expenses yet"
      emptyBody="Record rent, fuel, airtime — anything you paid for directly. Keep the eTIMS receipt: KRA disallows expenses without one."
    />
  );
}
