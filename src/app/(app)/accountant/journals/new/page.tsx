import { eq, and } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import { redirect } from "next/navigation";
import { db, accounts } from "@/db";
import { createManualJournal } from "@/lib/actions";
import { parseKES, todayISO } from "@/lib/money";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const ROWS = 6;

export default async function NewJournalPage() {
  const o = await getOrg();
  const accts = await db.select().from(accounts).where(eq(accounts.orgId, o.id));

  async function create(formData: FormData) {
    "use server";
    const lines = [];
    for (let i = 0; i < ROWS; i++) {
      const accountId = Number(formData.get(`account${i}`));
      const debit = parseKES(String(formData.get(`debit${i}`) || "")) || 0;
      const credit = parseKES(String(formData.get(`credit${i}`) || "")) || 0;
      if (accountId && (debit || credit)) {
        lines.push({ accountId, debitCents: debit, creditCents: credit });
      }
    }
    await createManualJournal({
      date: String(formData.get("date") || todayISO()),
      memo: String(formData.get("memo") || "Manual journal"),
      lines,
    });
    redirect("/accountant/journals");
  }

  const input =
    "w-full rounded-md border border-[var(--color-ink-200)] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)]";

  return (
    <>
      <PageHeader
        title="Manual journal"
        subtitle="For adjustments your accountant asks for — debits must equal credits"
      />
      <form action={create} className="card p-6 max-w-3xl space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Date</span>
            <input type="date" name="date" defaultValue={todayISO()} className={input + " mt-1"} />
          </label>
          <label className="block col-span-2">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Memo</span>
            <input name="memo" className={input + " mt-1"} placeholder="Reason for this entry" />
          </label>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-[11.5px] uppercase tracking-wide text-[var(--color-ink-400)]">
              <th className="text-left py-1 font-semibold">Account</th>
              <th className="text-right py-1 font-semibold w-32">Debit (KSh)</th>
              <th className="text-right py-1 font-semibold w-32">Credit (KSh)</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }).map((_, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <select name={`account${i}`} className={input}>
                    <option value="">—</option>
                    {accts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 px-1">
                  <input name={`debit${i}`} className={input + " text-right"} placeholder="0.00" />
                </td>
                <td className="py-1 pl-1">
                  <input name={`credit${i}`} className={input + " text-right"} placeholder="0.00" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-3">
          <button className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium px-5 py-2.5">
            Post journal
          </button>
          <a href="/accountant/journals" className="text-[13px] text-[var(--color-ink-400)] self-center">Cancel</a>
        </div>
        <p className="text-[12px] text-[var(--color-ink-400)]">
          If the entry doesn&apos;t balance it will be rejected — that&apos;s the ledger protecting you.
        </p>
      </form>
    </>
  );
}
