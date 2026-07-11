import { requirePerm } from "@/lib/guard";
import { PageHeader, PrimaryButton } from "@/components/ui";
import { createRuleAction } from "../actions";
import { RuleForm } from "./RuleForm";

export const dynamic = "force-dynamic";

export default async function NewRulePage() {
  await requirePerm("payroll");

  return (
    <>
      <PageHeader 
        title="Add Statutory Rule" 
        subtitle="Create a new tax bracket, deduction, or statutory contribution rule"
      />
      <div className="card max-w-2xl mt-6">
        <RuleForm />
      </div>
    </>
  );
}
