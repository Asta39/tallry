import { withOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { eq, and } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import { redirect } from "next/navigation";
import { db, bankAccounts, bankTransactions, accounts } from "@/db";
import { desc, inArray } from "drizzle-orm";
import { fmtKES, parseKES, todayISO } from "@/lib/money";
import { addBankTransaction, categorizeTransaction } from "@/lib/actions";
import { accountBalances } from "@/lib/reports";
import { PageHeader, StatusPill, TableCard, Th, Td } from "@/components/ui";
import { BankImport } from "@/components/BankImport";

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

      <h2 className="text-[15px] font-semibold mt-8 mb-3">Import statement</h2>
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

      <h2 className="text-[15px] font-semibold mt-8 mb-3">Transactions</h2>
      {txns.length === 0 ? (
        <div className="card px-6 py-10 text-center text-[13px] text-[var(--color-ink-400)]">
          No bank transactions yet. Add money in/out above, then categorize each line — that&apos;s what books it into your accounts.
        </div>
      ) : (
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Date</Th><Th>Account</Th><Th>Description</Th><Th>Status</Th><Th right>Amount</Th><Th>Categorize as</Th>
            </tr>
          </thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t.id} className="hairline-t">
                <Td className="text-[var(--color-ink-400)]">{t.date}</Td>
                <Td>{banks.find((b) => b.id === t.bankAccountId)?.name}</Td>
                <Td>{t.description}</Td>
                <Td><StatusPill status={t.status} /></Td>
                <Td right className={t.amountCents < 0 ? "text-[var(--color-bad)]" : "text-[var(--color-good)]"}>
                  {fmtKES(t.amountCents, { signed: true })}
                </Td>
                <Td>
                  {t.status === "uncategorized" ? (
                    <form action={categorize} className="flex gap-1">
                      <input type="hidden" name="txnId" value={t.id} />
                      <select name="categoryAccountId" className="rounded border border-[var(--color-ink-200)] text-[12px] px-1.5 py-1 bg-white max-w-44">
                        {categories
                          .filter((c) => (t.amountCents >= 0 ? c.type === "income" : c.type === "expense"))
                          .map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                      </select>
                      <button className="text-[12px] text-[var(--color-accent-600)] font-medium">Book it</button>
                    </form>
                  ) : (
                    <span className="text-[12px] text-[var(--color-ink-400)]">
                      {categories.find((c) => c.id === t.categoryAccountId)?.name ?? "—"}
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
