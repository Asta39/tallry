"use client";

import { useState, useTransition } from "react";
import { updatePortalProfileAction } from "./actions";

export function ProfileForm({
  slug,
  contact,
}: {
  slug: string;
  contact: { displayName: string; phone: string | null; email: string | null; address: string | null; city: string | null; kraPin: string | null };
}) {
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [address, setAddress] = useState(contact.address ?? "");
  const [city, setCity] = useState(contact.city ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await updatePortalProfileAction(slug, { phone, email, address, city });
      if (res.error) setError(res.error);
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-lg space-y-4">
      <div>
        <label className="block text-[13px] font-medium text-[var(--color-ink-600)] mb-1">Business / Contact Name</label>
        <input
          disabled
          value={contact.displayName}
          className="w-full px-3 py-2.5 border border-[var(--color-ink-200)] rounded-lg text-[14px] bg-[var(--color-ink-50)] text-[var(--color-ink-500)]"
        />
        <p className="text-[12px] text-[var(--color-ink-400)] mt-1">Contact your account manager to change this.</p>
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[var(--color-ink-600)] mb-1">Phone</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="2547..."
          className="w-full px-3 py-2.5 border border-[var(--color-ink-200)] rounded-lg text-[14px] focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none transition-all"
        />
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[var(--color-ink-600)] mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2.5 border border-[var(--color-ink-200)] rounded-lg text-[14px] focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none transition-all"
        />
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[var(--color-ink-600)] mb-1">Address</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full px-3 py-2.5 border border-[var(--color-ink-200)] rounded-lg text-[14px] focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none transition-all"
        />
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[var(--color-ink-600)] mb-1">City</label>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full px-3 py-2.5 border border-[var(--color-ink-200)] rounded-lg text-[14px] focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none transition-all"
        />
      </div>

      {contact.kraPin && (
        <div>
          <label className="block text-[13px] font-medium text-[var(--color-ink-600)] mb-1">KRA PIN</label>
          <input
            disabled
            value={contact.kraPin}
            className="w-full px-3 py-2.5 border border-[var(--color-ink-200)] rounded-lg text-[14px] bg-[var(--color-ink-50)] text-[var(--color-ink-500)]"
          />
        </div>
      )}

      {error && <div className="text-[13px] text-[var(--color-bad)] font-medium bg-[var(--color-bad)]/10 p-3 rounded-lg">{error}</div>}
      {saved && <div className="text-[13px] text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 p-3 rounded-lg">Saved.</div>}

      <div className="pt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2 bg-[var(--color-ink-900)] text-white text-[13px] font-semibold rounded-lg hover:bg-black transition-all disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
