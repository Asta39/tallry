"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveContact } from "@/lib/actions";

type Group = { id: number; name: string };

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
  groupId?: number | null;
}

const input =
  "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] mt-1";
const labelCls = "text-[12px] font-medium text-[var(--color-ink-600)]";

export function ContactForm({ initial, groups }: { initial?: ContactFormInitial; groups: Group[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState(initial?.kind ?? "customer");
  const [groupId, setGroupId] = useState<number | "">(initial?.groupId ?? "");

  const isCustomer = kind === "customer" || kind === "both";

  function submit(formData: FormData) {
    setError(null);
    if (isCustomer && !groupId) {
      setError(groups.length === 0 ? "Create a customer group first — an admin can add one under Customer Groups." : "Pick a customer group.");
      return;
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
          groupId: isCustomer ? Number(groupId) : null,
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
        <label className="block col-span-2">
          <span className={labelCls}>Customer group *</span>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : "")}
            className={input}
            disabled={groups.length === 0}
          >
            <option value="">{groups.length === 0 ? "No groups yet — an admin must create one" : "Choose a group…"}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <span className="text-[11px] text-[var(--color-ink-400)] block mt-1">Used to slice customer reports by segment.</span>
        </label>
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
