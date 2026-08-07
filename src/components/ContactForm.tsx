"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveContact } from "@/lib/actions";

type Group = { id: number; name: string; parentGroupId?: number | null };

export interface ContactFormInitial {
  id?: number;
  kind: string;
  displayName: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  kraPin?: string | null;
  address?: string | null;
  city?: string | null;
  notes?: string | null;
  isWithholdingAgent?: boolean;
  payoutDestinationType?: string | null;
  payoutDestination?: string | null;
  payoutAccountNumber?: string | null;
  groupIds?: number[];
}

const input =
  "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] mt-1";
const labelCls = "text-[12px] font-medium text-[var(--color-ink-600)]";

export function ContactForm({ initial, groups, groupsRequired = true }: { initial?: ContactFormInitial; groups: Group[]; groupsRequired?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState(initial?.kind ?? "customer");
  const [groupIds, setGroupIds] = useState<number[]>(initial?.groupIds ?? []);

  const isCustomer = kind === "customer" || kind === "both";
  const isVendor = kind === "vendor" || kind === "both";

  const [payoutDestinationType, setPayoutDestinationType] = useState(initial?.payoutDestinationType || "");
  const [payoutDestination, setPayoutDestination] = useState(initial?.payoutDestination || "");
  const [payoutAccountNumber, setPayoutAccountNumber] = useState(initial?.payoutAccountNumber || "");

  // Depth-first order, subgroups directly under their parent — a flat list
  // sorted alphabetically would scatter a group's children away from it.
  const orderedGroups = (() => {
    const byParent = new Map<number | null, Group[]>();
    for (const g of groups) {
      const key = g.parentGroupId ?? null;
      const arr = byParent.get(key) ?? [];
      arr.push(g);
      byParent.set(key, arr);
    }
    const out: { group: Group; depth: number }[] = [];
    function walk(parentId: number | null, depth: number) {
      for (const g of byParent.get(parentId) ?? []) {
        out.push({ group: g, depth });
        walk(g.id, depth + 1);
      }
    }
    walk(null, 0);
    return out;
  })();

  function toggleGroup(id: number) {
    setGroupIds((cur) => (cur.includes(id) ? cur.filter((g) => g !== id) : [...cur, id]));
  }

  function submit(formData: FormData) {
    setError(null);
    if (isCustomer && groupsRequired && groupIds.length === 0) {
      setError(groups.length === 0 ? "Create a customer group first — an admin can add one under Customer Groups." : "Pick at least one customer group.");
      return;
    }
    if (isVendor && !initial?.id) {
      if (!payoutDestinationType) return setError("Select how this vendor gets paid (mobile number, till, or paybill)");
      if (!payoutDestination.trim()) return setError("Enter the vendor's payout destination");
      if (payoutDestinationType === "paybill" && !payoutAccountNumber.trim()) return setError("Enter the paybill account number");
    }
    start(async () => {
      try {
        await saveContact({
          id: initial?.id,
          kind,
          displayName: String(formData.get("displayName") || "").trim(),
          companyName: String(formData.get("companyName") || "") || undefined,
          email: String(formData.get("email") || "") || undefined,
          phone: String(formData.get("phone") || "") || undefined,
          kraPin: String(formData.get("kraPin") || "") || undefined,
          address: String(formData.get("address") || "") || undefined,
          city: String(formData.get("city") || "") || undefined,
          notes: String(formData.get("notes") || "") || undefined,
          isWithholdingAgent: formData.get("isWithholdingAgent") === "on",
          payoutDestinationType: isVendor && payoutDestinationType ? (payoutDestinationType as "phone" | "till" | "paybill") : null,
          payoutDestination: isVendor ? payoutDestination.trim() || null : null,
          payoutAccountNumber: isVendor && payoutDestinationType === "paybill" ? payoutAccountNumber.trim() || null : null,
          groupIds: isCustomer ? groupIds : [],
        });
        router.push(initial?.id ? `/contacts/${initial.id}` : "/contacts");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save contact");
      }
    });
  }

  return (
    <form action={submit} className="card p-6 max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
      <label className="block">
        <span className={labelCls}>They are a…</span>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={input}>
          <option value="customer">Customer</option>
          <option value="vendor">Vendor / supplier</option>
          <option value="both">Both</option>
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>Name *</span>
        <input name="displayName" required defaultValue={initial?.displayName} className={input} placeholder="Jane Wanjiku / Acme Ltd" />
      </label>

      {isCustomer && (
        <div className="block col-span-2">
          <span className={labelCls}>
            Customer groups {groupsRequired ? "*" : ""} <span className="font-normal text-[var(--color-ink-400)]">(pick one or more)</span>
          </span>
          {groups.length === 0 ? (
            <div className="mt-1 text-[12.5px] text-[var(--color-ink-500)]">
              No groups yet — an admin must create one under Customer Groups first.
            </div>
          ) : (
            <div className="mt-1 flex flex-wrap gap-2">
              {orderedGroups.map(({ group: g, depth }) => {
                const on = groupIds.includes(g.id);
                return (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() => toggleGroup(g.id)}
                    style={depth > 0 ? { marginLeft: depth * 14 } : undefined}
                    className={`rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${
                      on
                        ? "bg-[var(--color-accent-500)] border-[var(--color-accent-500)] text-white"
                        : "bg-white border-[var(--color-ink-200)] text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
                    }`}
                  >
                    {on ? "✓ " : ""}
                    {depth > 0 ? "↳ " : ""}
                    {g.name}
                  </button>
                );
              })}
            </div>
          )}
          <span className="text-[11px] text-[var(--color-ink-400)] block mt-1">Used to slice customer reports by segment. A customer can belong to several.</span>
        </div>
      )}

      <label className="block">
        <span className={labelCls}>Company</span>
        <input name="companyName" defaultValue={initial?.companyName ?? ""} className={input} />
      </label>
      <label className="block">
        <span className={labelCls}>KRA PIN</span>
        <input name="kraPin" defaultValue={initial?.kraPin ?? ""} className={input} placeholder="P0…" />
      </label>
      <label className="block">
        <span className={labelCls}>Phone</span>
        <input name="phone" defaultValue={initial?.phone ?? ""} className={input} placeholder="+254 7…" />
      </label>
      <label className="block">
        <span className={labelCls}>Email</span>
        <input name="email" type="email" defaultValue={initial?.email ?? ""} className={input} />
      </label>
      <label className="block">
        <span className={labelCls}>Address</span>
        <input name="address" defaultValue={initial?.address ?? ""} className={input} />
      </label>
      <label className="block">
        <span className={labelCls}>City</span>
        <input name="city" defaultValue={initial?.city ?? ""} className={input} placeholder="Nairobi" />
      </label>
      <label className="block col-span-2">
        <span className={labelCls}>Notes</span>
        <textarea name="notes" defaultValue={initial?.notes ?? ""} className={input + " h-20 resize-none"} />
      </label>

      <label className="flex items-center gap-2 col-span-2 text-[12.5px] text-[var(--color-ink-600)]">
        <input type="checkbox" name="isWithholdingAgent" defaultChecked={initial?.isWithholdingAgent} className="accent-[var(--color-accent-500)]" />
        Appointed KRA withholding agent (they deduct 2% VAT / WHT when paying you)
      </label>

      {isVendor && (
        <div className="col-span-2 rounded-xl border border-[var(--color-ink-200)] bg-[var(--color-ink-50)]/50 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-2 text-[12px] font-medium text-[var(--color-ink-700)]">
            Payment details{" "}
            <span className="font-normal text-[var(--color-ink-400)]">
              ({initial?.id ? "autofills new bills/POs for this vendor" : "required — autofills new bills/POs for this vendor"})
            </span>
          </div>
          <label className="block">
            <span className={labelCls}>Pay via{initial?.id ? "" : " *"}</span>
            <select value={payoutDestinationType} onChange={(e) => setPayoutDestinationType(e.target.value)} className={input}>
              <option value="">Not set</option>
              <option value="phone">Mobile number (B2C)</option>
              <option value="till">Till number</option>
              <option value="paybill">Paybill</option>
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>
              {payoutDestinationType === "till" ? "Till number" : payoutDestinationType === "paybill" ? "Paybill number" : "Mobile number"}
              {initial?.id ? "" : " *"}
            </span>
            <input
              value={payoutDestination}
              onChange={(e) => setPayoutDestination(e.target.value)}
              className={input}
              placeholder={payoutDestinationType === "phone" || !payoutDestinationType ? "2547…" : "e.g. 123456"}
              disabled={!payoutDestinationType}
            />
          </label>
          {payoutDestinationType === "paybill" && (
            <label className="block">
              <span className={labelCls}>Account number</span>
              <input value={payoutAccountNumber} onChange={(e) => setPayoutAccountNumber(e.target.value)} className={input} placeholder="Account / reference number" />
            </label>
          )}
        </div>
      )}

      {error && <div className="col-span-2 text-[13px] text-[var(--color-bad)]">{error}</div>}

      <div className="col-span-2 flex gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white text-[13px] font-medium px-5 py-2.5"
        >
          {pending ? "Saving…" : "Save contact"}
        </button>
        <Link
          href={initial?.id ? `/contacts/${initial.id}` : "/contacts"}
          className="text-[13px] text-[var(--color-ink-400)] self-center"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
