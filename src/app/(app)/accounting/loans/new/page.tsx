import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { PageHeader } from "@/components/ui";
import { loanFormOptions } from "../data";
import { NewLoanForm } from "./NewLoanForm";

export const dynamic = "force-dynamic";

export default async function NewBusinessLoanPage() {
  await requirePerm("accountant");
  const o = await getOrg();
  const opts = await loanFormOptions(o.id);
  return (
    <>
      <PageHeader title="Record a loan" subtitle="Money the business borrowed from a bank, SACCO, M-Pesa loan, asset financier or director" />
      <div className="card max-w-2xl px-6 py-5">
        <NewLoanForm
          liabilityAccounts={opts.liabilityAccounts}
          interestAccounts={opts.interestAccounts}
          bankAccounts={opts.bankAccounts}
          defaultLiabilityId={opts.defaultLiabilityId}
          defaultInterestId={opts.defaultInterestId}
        />
      </div>
    </>
  );
}
