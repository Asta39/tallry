"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { fmtKES } from "@/lib/money";
import { createAccountAction, updateAccountAction, archiveAccountAction } from "@/lib/chart-of-accounts";

type Account = {
  id: number;
  code: string;
  name: string;
  type: string;
  subtype: string;
  description: string | null;
  isSystem: boolean;
  archived: boolean;
  parentAccountId: number | null;
};

const TYPE_LABELS: Record<string, string> = {
  asset: "Assets — what you own",
  liability: "Liabilities — what you owe",
  equity: "Equity — the owner's stake",
  income: "Income",
  expense: "Expenses",
};

const inputCls = "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all";

function AccountModal({
  mode,
  account,
  siblingsForType,
  onClose,
}: {
  mode: "create" | "edit";
  account?: Account;
  siblingsForType: Account[];
  onClose: () => void;
}) {
  const [code, setCode] = useState(account?.code || "");
  const [name, setName] = useState(account?.name || "");
  const [type, setType] = useState(account?.type || "expense");
  const [subtype, setSubtype] = useState(account?.subtype || "other");
  const [description, setDescription] = useState(account?.description || "");
  const [parentAccountId, setParentAccountId] = useState<number | "">(account?.parentAccountId || "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const parentCandidates = siblingsForType.filter((a) => a.type === type && a.id !== account?.id && !a.archived);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createAccountAction({
            code, name, type: type as any, subtype, description: description || undefined,
            parentAccountId: parentAccountId === "" ? null : Number(parentAccountId),
          });
        } else {
          await updateAccountAction(account!.id, {
            name, subtype, description: description || undefined,
            parentAccountId: parentAccountId === "" ? null : Number(parentAccountId),
          });
        }
        onClose();
        window.location.reload();
      } catch (e: any) {
        setError(e.message || "Something went wrong");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-[16px] font-semibold">{mode === "create" ? "New account" : `Edit ${account!.name}`}</h3>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Code</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} disabled={mode === "edit"} required className={inputCls + " mt-1 disabled:bg-[var(--color-ink-50)] disabled:text-[var(--color-ink-400)]"} />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Type</span>
            <select value={type} onChange={(e) => { setType(e.target.value); setParentAccountId(""); }} disabled={mode === "edit"} className={inputCls + " mt-1 disabled:bg-[var(--color-ink-50)] disabled:text-[var(--color-ink-400)]"}>
              {Object.keys(TYPE_LABELS).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls + " mt-1"} />
        </label>

        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Parent account (optional)</span>
          <select value={parentAccountId} onChange={(e) => setParentAccountId(e.target.value ? Number(e.target.value) : "")} className={inputCls + " mt-1"}>
            <option value="">None — top level</option>
            {parentCandidates.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Description (optional)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls + " mt-1 resize-none"} />
        </label>

        {error && <p className="text-[12.5px] text-[var(--color-bad)]">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={pending} className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors">
            {pending ? "Saving…" : mode === "create" ? "Create account" : "Save changes"}
          </button>
          <button type="button" onClick={onClose} className="text-[13px] text-[var(--color-ink-500)] hover:underline">Cancel</button>
        </div>
      </form>
    </div>
  );
}

export function ChartOfAccountsClient({ accounts, balances: balancesObj }: { accounts: Account[]; balances: Record<number, number> }) {
  const balances = new Map(Object.entries(balancesObj).map(([k, v]) => [Number(k), v]));
  const [modal, setModal] = useState<{ mode: "create" | "edit"; account?: Account } | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const byParent = new Map<number | null, Account[]>();
  for (const a of accounts) {
    const key = a.parentAccountId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(a);
  }

  function toggleArchive(a: Account) {
    setArchiveError(null);
    setPendingId(a.id);
    startTransition(async () => {
      try {
        await archiveAccountAction(a.id, !a.archived);
        window.location.reload();
      } catch (e: any) {
        setArchiveError(e.message || "Could not update account");
        setPendingId(null);
      }
    });
  }

  function Row({ a, depth }: { a: Account; depth: number }) {
    const children = byParent.get(a.id) || [];
    return (
      <>
        <tr className={`hairline-t ${a.archived ? "opacity-50" : ""}`}>
          <td className="px-4 py-2.5 text-[13px] tnum text-[var(--color-ink-400)] whitespace-nowrap">{a.code}</td>
          <td className="px-3 py-2.5 text-[13px]" style={{ paddingLeft: `${12 + depth * 20}px` }}>
            <Link href={`/accountant/ledger/${a.id}`} className="font-medium hover:text-[var(--color-accent-600)]">{a.name}</Link>
            {a.isSystem && <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--color-ink-400)]">system</span>}
            {a.archived && <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--color-bad)]">archived</span>}
          </td>
          <td className="px-3 py-2.5 text-[13px] text-right tnum">{fmtKES(balances.get(a.id) ?? 0)}</td>
          <td className="px-4 py-2.5 text-right whitespace-nowrap">
            <button onClick={() => setModal({ mode: "edit", account: a })} className="text-[12px] font-medium text-[var(--color-ink-600)] hover:underline mr-3">Edit</button>
            {!a.isSystem && (
              <button
                disabled={pendingId === a.id}
                onClick={() => toggleArchive(a)}
                className={`text-[12px] font-medium hover:underline disabled:opacity-50 ${a.archived ? "text-[var(--color-good)]" : "text-[var(--color-bad)]"}`}
              >
                {pendingId === a.id ? "…" : a.archived ? "Restore" : "Archive"}
              </button>
            )}
          </td>
        </tr>
        {children.map((c) => <Row key={c.id} a={c} depth={depth + 1} />)}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-[var(--color-ink-400)]">Sub-accounts must share their parent&apos;s type. Type can&apos;t be changed after creation — it decides the debit/credit sign for every posted entry.</p>
        <button onClick={() => setModal({ mode: "create" })} className="shrink-0 rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium px-4 py-2 transition-colors">
          + Add account
        </button>
      </div>
      {archiveError && <p className="text-[12.5px] text-[var(--color-bad)]">{archiveError}</p>}

      {(["asset", "liability", "equity", "income", "expense"] as const).map((type) => {
        const topLevel = (byParent.get(null) || []).filter((a) => a.type === type);
        if (topLevel.length === 0) return null;
        return (
          <div key={type}>
            <h2 className="text-[13px] font-semibold text-[var(--color-ink-600)] mb-2">{TYPE_LABELS[type]}</h2>
            <div className="card overflow-hidden">
              <table className="w-full text-left">
                <thead className="hairline-b">
                  <tr>
                    <th className="px-4 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">Code</th>
                    <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">Account</th>
                    <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide text-right">Balance</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {topLevel.map((a) => <Row key={a.id} a={a} depth={0} />)}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {modal && (
        <AccountModal
          mode={modal.mode}
          account={modal.account}
          siblingsForType={accounts}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
