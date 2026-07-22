"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveOrgProfile } from "@/lib/actions";

export default function OnboardingPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [kraPin, setKraPin] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [vatRegistered, setVatRegistered] = useState(true);
  const [invoicePrefix, setInvoicePrefix] = useState("INV-");

  // Logo state
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Logo must be under 2 MB.");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setError(null);
  }

  async function uploadLogo(userId: string): Promise<string | null> {
    if (!logoFile) return null;
    setLogoUploading(true);
    try {
      const supabase = createClient();
      const ext = logoFile.name.split(".").pop();
      const path = `${userId}/logo.${ext}`;
      const { error } = await supabase.storage
        .from("logos")
        .upload(path, logoFile, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("logos").getPublicUrl(path);
      return data.publicUrl;
    } finally {
      setLogoUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Business name is required.");
      return;
    }
    startTransition(async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const logoUrl = await uploadLogo(user.id);

        await saveOrgProfile({
          name: name.trim(),
          kraPin: kraPin || undefined,
          vatRegistered,
          address: address || undefined,
          phone: phone || undefined,
          email: email || undefined,
          invoicePrefix: invoicePrefix || "INV-",
          logoUrl: logoUrl ?? undefined,
        });
        router.push("/");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all mt-1";
  const labelCls = "text-[12px] font-medium text-[var(--color-ink-600)]";

  return (
    <div className="min-h-screen bg-[var(--color-ink-50)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[560px]">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-2">
            <img src="/images/logo.png" alt="Zeno Logo" className="h-40 w-auto object-contain" />
          </div>
          <h1 className="text-[24px] font-semibold text-[var(--color-ink-900)] leading-tight">
            Set up your business
          </h1>
          <p className="text-[13.5px] text-[var(--color-ink-400)] mt-2">
            This takes 30 seconds. You can update everything later in Settings.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Logo + name card */}
          <div className="card p-6">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-4">
              Business identity
            </div>

            {/* Logo upload */}
            <div className="flex items-start gap-4 mb-5">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative shrink-0 w-[72px] h-[72px] rounded-2xl border-2 border-dashed border-[var(--color-ink-200)] hover:border-[var(--color-accent-500)] flex items-center justify-center transition-colors overflow-hidden bg-[var(--color-ink-50)] group"
                aria-label="Upload business logo"
              >
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="object-cover w-full h-full rounded-[14px]"
                  />
                ) : (
                  <div className="text-center">
                    <div className="text-[22px] opacity-30 group-hover:opacity-60 transition-opacity">🏢</div>
                    <div className="text-[9px] text-[var(--color-ink-400)] mt-0.5 font-medium">Logo</div>
                  </div>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoChange}
              />
              <div className="flex-1">
                <label className="block">
                  <span className={labelCls}>
                    Business name <span className="text-[var(--color-bad)]">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. Wanjiku Traders Ltd"
                  />
                </label>
                <p className="text-[11px] text-[var(--color-ink-400)] mt-1.5">
                  Click the box on the left to add your logo (PNG/JPG, max 2 MB)
                </p>
              </div>
            </div>

            {/* KRA PIN */}
            <label className="block">
              <span className={labelCls}>KRA PIN</span>
              <input
                type="text"
                value={kraPin}
                onChange={(e) => setKraPin(e.target.value.toUpperCase())}
                className={inputCls}
                placeholder="P051234567X"
                maxLength={11}
              />
              <p className="text-[11px] text-[var(--color-ink-400)] mt-1">
                Appears on eTIMS invoices and VAT returns
              </p>
            </label>
          </div>

          {/* Contact details */}
          <div className="card p-6">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-4">
              Contact details (appear on invoices)
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className={labelCls}>Phone</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls}
                  placeholder="+254 7xx xxx xxx"
                />
              </label>
              <label className="block">
                <span className={labelCls}>Business email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="info@yourco.co.ke"
                />
              </label>
              <label className="block col-span-2">
                <span className={labelCls}>Address</span>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={inputCls}
                  placeholder="P.O. Box 123, Nairobi, Kenya"
                />
              </label>
            </div>
          </div>

          {/* Tax & invoicing */}
          <div className="card p-6">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-4">
              Tax & invoicing
            </div>
            <label className="flex items-start gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={vatRegistered}
                onChange={(e) => setVatRegistered(e.target.checked)}
                className="accent-[var(--color-accent-500)] mt-0.5"
              />
              <div>
                <div className="text-[13px] font-medium text-[var(--color-ink-900)]">
                  VAT-registered
                </div>
                <div className="text-[12px] text-[var(--color-ink-400)] mt-0.5">
                  Taxable turnover over KES 5M/year — invoices will charge 16% VAT
                </div>
              </div>
            </label>
            <label className="block max-w-[200px]">
              <span className={labelCls}>Invoice number prefix</span>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                className={inputCls}
                placeholder="INV-"
                maxLength={8}
              />
              <p className="text-[11px] text-[var(--color-ink-400)] mt-1">
                e.g. INV-0001, BB-0001
              </p>
            </label>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-[12.5px] text-[var(--color-bad)]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending || logoUploading}
            className="w-full rounded-xl bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[14px] font-semibold py-3 transition-colors shadow-[0_2px_8px_rgba(15,118,110,0.25)]"
          >
            {logoUploading
              ? "Uploading logo…"
              : pending
              ? "Setting up your books…"
              : "Finish setup →"}
          </button>

          <p className="text-center text-[12px] text-[var(--color-ink-400)]">
            Everything can be changed later in Settings
          </p>
        </form>
      </div>
    </div>
  );
}
