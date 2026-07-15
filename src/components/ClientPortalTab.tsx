"use client";

import { useState, useTransition } from "react";
import { updatePortalUserAction } from "@/lib/actions";

export function ClientPortalTab({
  contactId,
  portalUser,
  orgSlug,
}: {
  contactId: number;
  portalUser: { email: string; isActive: boolean } | null;
  orgSlug: string;
}) {
  const [pending, start] = useTransition();
  const [email, setEmail] = useState(portalUser?.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const portalLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${orgSlug}/login`;

  const handleSave = () => {
    setError(null);
    setSuccess(null);
    if (!email) {
      setError("Email is required");
      return;
    }
    if (!portalUser && !password) {
      setError("Password is required for new users");
      return;
    }

    start(async () => {
      try {
        const res = await updatePortalUserAction(contactId, email, password);
        if (res.error) setError(res.error);
        else {
          setSuccess("Portal user updated successfully");
          setPassword(""); // clear password input
        }
      } catch (err: any) {
        setError(err.message || "An error occurred");
      }
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(portalLink);
    setSuccess("Link copied to clipboard!");
    setTimeout(() => setSuccess(null), 3000);
  };

  return (
    <div className="card p-6 max-w-lg">
      <h2 className="text-[16px] font-bold text-[var(--color-ink-900)] mb-1">Client Portal Access</h2>
      <p className="text-[13.5px] text-[var(--color-ink-600)] mb-6">
        Grant this customer access to their dedicated portal to view quotes, invoices, and statements.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-[13px] font-semibold text-[var(--color-ink-900)] mb-1">Login Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com"
            className="w-full px-3 py-2 border border-[var(--color-ink-200)] rounded-lg text-[13.5px] focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-[var(--color-ink-900)] mb-1">
            {portalUser ? "Reset Password (leave blank to keep current)" : "Password"}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={portalUser ? "••••••••" : "Enter a secure password"}
            className="w-full px-3 py-2 border border-[var(--color-ink-200)] rounded-lg text-[13.5px] focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none transition-all"
          />
        </div>

        {error && <div className="text-[13px] text-[var(--color-bad)] font-medium bg-[var(--color-bad)]/10 p-3 rounded-lg">{error}</div>}
        {success && <div className="text-[13px] text-[var(--color-good)] font-medium bg-[var(--color-good)]/10 p-3 rounded-lg">{success}</div>}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={pending}
            className="px-5 py-2.5 bg-[var(--color-brand)] text-white text-[13px] font-bold rounded-lg shadow-sm hover:opacity-90 transition-all disabled:opacity-50"
          >
            {pending ? "Saving..." : portalUser ? "Update Access" : "Grant Access"}
          </button>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-[var(--color-ink-100)]">
        <label className="block text-[13px] font-semibold text-[var(--color-ink-900)] mb-2">Portal Login Link</label>
        <div className="flex gap-2">
          <input 
            readOnly 
            value={portalLink} 
            className="flex-1 px-3 py-2 bg-[var(--color-ink-50)] border border-[var(--color-ink-200)] rounded-lg text-[13px] text-[var(--color-ink-600)] outline-none"
          />
          <button
            onClick={handleCopy}
            className="px-4 py-2 border border-[var(--color-ink-200)] rounded-lg text-[13px] font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] transition-all whitespace-nowrap"
          >
            Copy Link
          </button>
        </div>
      </div>
    </div>
  );
}
