import { requirePerm } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { NewBudgetForm } from "./NewBudgetForm";

export const dynamic = "force-dynamic";

export default async function NewBudgetPage() {
  await requirePerm("accountant");
  return (
    <>
      <PageHeader title="New Budget" />
      <NewBudgetForm />
    </>
  );
}
