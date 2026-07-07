"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmtKES } from "@/lib/money";
import { StatusPill, TableCard, Th, Td } from "@/components/ui";

export function BankingTransactionsClient({
  txns,
  banks,
  categories,
  bulkCategorizeAction,
}: {
  txns: any[];
  banks: any[];
  categories: any[];
  bulkCategorizeAction: (updates: { txnId: number; categoryAccountId: number }[]) => Promise<void>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const uncategorized = txns.filter((t) => t.status === "uncategorized");

  // Simple auto-categorization based on keywords
  const initialCategoryMap = useMemo(() => {
    const map: Record<number, number> = {};
    for (const t of uncategorized) {
      const desc = t.description.toLowerCase();
      const options = categories.filter((c) => (t.amountCents >= 0 ? c.type === "income" : c.type === "expense"));
      
      let matchedId = options[0]?.id;
      
      // Heuristics
      if (t.amountCents < 0) {
        if (desc.includes("safaricom") || desc.includes("internet") || desc.includes("airtel")) {
          matchedId = options.find((c) => c.name.toLowerCase().includes("internet") || c.name.toLowerCase().includes("telephone"))?.id || matchedId;
        } else if (desc.includes("kra") || desc.includes("tax")) {
          matchedId = options.find((c) => c.name.toLowerCase().includes("tax"))?.id || matchedId;
        } else if (desc.includes("salary") || desc.includes("wage")) {
          matchedId = options.find((c) => c.name.toLowerCase().includes("salar"))?.id || matchedId;
        } else if (desc.includes("kplc") || desc.includes("power") || desc.includes("electricity")) {
          matchedId = options.find((c) => c.name.toLowerCase().includes("electric") || c.name.toLowerCase().includes("utilit"))?.id || matchedId;
        } else if (desc.includes("rent")) {
          matchedId = options.find((c) => c.name.toLowerCase().includes("rent"))?.id || matchedId;
        }
      } else {
        if (desc.includes("sales") || desc.includes("payment")) {
          matchedId = options.find((c) => c.name.toLowerCase().includes("sales") || c.name.toLowerCase().includes("income"))?.id || matchedId;
        }
      }

      if (matchedId) {
        map[t.id] = matchedId;
      }
    }
    return map;
  }, [uncategorized, categories]);

  const [categoryMap, setCategoryMap] = useState<Record<number, number>>(initialCategoryMap);

  function handleBookAll() {
    start(async () => {
      const updates = uncategorized
        .map((t) => ({ txnId: t.id, categoryAccountId: categoryMap[t.id] }))
        .filter((u) => u.categoryAccountId);
      
      if (updates.length > 0) {
        await bulkCategorizeAction(updates);
        router.refresh();
      }
    });
  }

  if (txns.length === 0) {
    return (
      <div className="card px-6 py-10 text-center text-[13px] text-[var(--color-ink-400)]">
        No bank transactions yet. Add money in/out above, then categorize each line — that&apos;s what books it into your accounts.
      </div>
    );
  }

  return (
    <>
      {uncategorized.length > 0 && (
        <div className="flex justify-end mb-3">
          <button
            onClick={handleBookAll}
            disabled={pending}
            className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white text-[13px] font-medium px-5 py-2 transition-colors"
          >
            {pending ? "Booking..." : `Book all (${uncategorized.length}) uncategorized`}
          </button>
        </div>
      )}
      <TableCard>
        <thead className="hairline-b">
          <tr>
            <Th>Date</Th><Th>Account</Th><Th>Description</Th><Th>Status</Th><Th right>Amount</Th><Th>Category</Th>
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
                  <select
                    value={categoryMap[t.id] || ""}
                    onChange={(e) => setCategoryMap({ ...categoryMap, [t.id]: Number(e.target.value) })}
                    className="rounded border border-[var(--color-ink-200)] text-[12px] px-1.5 py-1 bg-white max-w-44"
                  >
                    <option value="" disabled>Select category</option>
                    {categories
                      .filter((c) => (t.amountCents >= 0 ? c.type === "income" : c.type === "expense"))
                      .map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
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
    </>
  );
}
