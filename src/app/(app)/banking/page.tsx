import { withOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { eq, and } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import { redirect } from "next/navigation";
import { db, bankAccounts, bankTransactions, accounts } from "@/db";
import { desc, inArray } from "drizzle-orm";
import { fmtKES, parseKES, todayISO } from "@/lib/money";
import { addBankTransaction, categorizeTransaction, bulkCategorizeTransactions, applyCategorizationRules, listCategorizationRules, deleteCategorizationRule } from "@/lib/actions";
import { accountBalances } from "@/lib/reports";
import { PageHeader, StatusPill, TableCard, Th, Td } from "@/components/ui";
import { BankImport } from "@/components/BankImport";
import { MpesaImport } from "@/components/MpesaImport";
import { BankingTransactionsClient } from "@/components/BankingTransactionsClient";

export const dynamic = "force-dynamic";

export default async function BankingPage() {
  await requirePerm("banking");
  const o = await getOrg();
  const banks = await db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, o.id), eq(bankAccounts.archived, false)));
  const txns = await db
    .select()
    .from(bankTransactions).where(eq(bankTransactions.orgId, o.id))
    .orderBy(desc(bankTransactions.date), desc(bankTransactions.id))
    .limit(50);
  const balances = await withOrg(() => accountBalances({}));
  const categories = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, o.id), inArray(accounts.type, ["income", "expense"])));

  // Learned-rule suggestions for the uncategorized rows
  const uncategorized = txns.filter((t) => t.status === "uncategorized");
  const suggestions = await withOrg(async () => {
    const { suggestCategories } = await import("@/lib/categorization");
    return suggestCategories(uncategorized);
  });
  const rules = await withOrg(() => listCategorizationRules());
  const acctName = (id: number) => categories.find((c) => c.id === id)?.name ?? `#${id}`;

  async function addTxn(formData: FormData) {
    "use server";
    const amt = parseKES(String(formData.get("amount") || ""));
    if (!amt) return;
    const isOut = formData.get("direction") === "out";
    await addBankTransaction({
      bankAccountId: Number(formData.get("bankAccountId")),
      date: String(formData.get("date") || todayISO()),
      description: String(formData.get("description") || "Transaction"),
      amountCents: isOut ? -Math.abs(amt) : Math.abs(amt),
    });
    redirect("/banking");
  }

  async function categorize(formData: FormData) {
    "use server";
    await categorizeTransaction(
      Number(formData.get("txnId")),
      Number(formData.get("categoryAccountId"))
    );
    redirect("/banking");
  }

  return (
    <>
      <PageHeader title="Bank & M-Pesa" subtitle="Your money accounts, per the ledger" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {banks.map((b) => {
          const bal = balances.find((x) => x.accountId === b.accountId)?.balanceCents ?? 0;
          return (
            <div key={b.id} className="card px-5 py-4">
              <div className="text-[12.5px] text-[var(--color-ink-600)]">{b.name}</div>
              <div className="money-lg mt-1">{fmtKES(bal)}</div>
              <div className="text-[11px] uppercase tracking-wide text-[var(--color-ink-400)] mt-0.5">{b.kind}</div>
            </div>
          );
        })}
      </div>

      <h2 className="text-[15px] font-semibold mt-8 mb-3">Import M-Pesa statement</h2>
      <MpesaImport banks={banks.map((b) => ({ id: b.id, label: b.name }))} />

      <h2 className="text-[15px] font-semibold mt-6 mb-3">Import CSV statement</h2>
      <BankImport banks={banks.map((b) => ({ id: b.id, label: b.name }))} />

      <h2 className="text-[15px] font-semibold mt-8 mb-3">Add a transaction</h2>
      <form action={addTxn} className="card p-3 flex gap-2 items-center flex-wrap">
        <select name="bankAccountId" className="rounded-md border border-[var(--color-ink-200)] px-2 py-2 text-[13px] bg-white">
          {banks.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select name="direction" className="rounded-md border border-[var(--color-ink-200)] px-2 py-2 text-[13px] bg-white">
          <option value="in">Money in</option>
          <option value="out">Money out</option>
        </select>
        <input type="date" name="date" defaultValue={todayISO()} className="rounded-md border border-[var(--color-ink-200)] px-2 py-2 text-[13px] bg-white" />
        <input name="description" placeholder="Description" className="flex-1 min-w-40 rounded-md border border-[var(--color-ink-200)] px-3 py-2 text-[13px]" />
        <input name="amount" placeholder="Amount (KSh)" className="w-32 rounded-md border border-[var(--color-ink-200)] px-3 py-2 text-[13px]" />
        <button className="rounded-md bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium px-4 py-2">
          Add
        </button>
      </form>

      <div className="flex items-center justify-between mt-8 mb-3 gap-3 flex-wrap">
        <h2 className="text-[15px] font-semibold">Transactions</h2>
        {uncategorized.length > 0 && rules.length > 0 && (
          <form
            action={async () => {
              "use server";
              await applyCategorizationRules();
              redirect("/banking");
            }}
          >
            <button className="rounded-lg border border-[var(--color-ink-200)] bg-white hover:bg-[var(--color-ink-50)] text-[13px] font-medium px-4 py-2">
              ⚡ Auto-categorize with saved rules ({rules.length})
            </button>
          </form>
        )}
      </div>
      <BankingTransactionsClient
        txns={txns}
        banks={banks}
        categories={categories}
        suggestions={suggestions}
        bulkCategorizeAction={async (updates) => {
          "use server";
          await bulkCategorizeTransactions(updates);
        }}
      />

      {rules.length > 0 && (
        <details className="mt-6">
          <summary className="text-[13px] font-medium text-[var(--color-ink-600)] cursor-pointer">
            Saved categorization rules ({rules.length})
          </summary>
          <p className="text-[12px] text-[var(--color-ink-400)] mt-1 mb-2">
            Learned from your past choices. When a transaction description contains the keyword, it&apos;s booked to that account automatically.
          </p>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[420px]">
              <thead className="hairline-b">
                <tr>
                  <Th>Keyword</Th><Th>Direction</Th><Th>Books to</Th><Th right>Used</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="hairline-t">
                    <Td className="font-medium">{r.keyword}</Td>
                    <Td className="text-[var(--color-ink-600)]">{r.direction === "in" ? "Money in" : "Money out"}</Td>
                    <Td>{acctName(r.categoryAccountId)}</Td>
                    <Td right className="tnum text-[var(--color-ink-400)]">{r.hits}×</Td>
                    <Td>
                      <form
                        action={async () => {
                          "use server";
                          await deleteCategorizationRule(r.id);
                          redirect("/banking");
                        }}
                      >
                        <button className="text-[12px] text-[var(--color-ink-400)] hover:text-[var(--color-bad)]">Remove</button>
                      </form>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
  );
}
