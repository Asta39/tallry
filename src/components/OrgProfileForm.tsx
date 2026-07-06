"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveOrgProfile } from "@/lib/actions";
import Image from "next/image";

interface OrgData {
  name: string;
  kraPin?: string | null;
  vatRegistered: boolean;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  invoicePrefix: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  userId?: string | null;
}

export function OrgProfileForm({ initial }: { initial: OrgData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(initial.name || "");
  const [kraPin, setKraPin] = useState(initial.kraPin || "");
  const [phone, setPhone] = useState(initial.phone || "");
  const [email, setEmail] = useState(initial.email || "");
  const [address, setAddress] = useState(initial.address || "");
  const [vatRegistered, setVatRegistered] = useState(initial.vatRegistered);
  const [invoicePrefix, setInvoicePrefix] = useState(initial.invoicePrefix || "INV-");
  const [brandColor, setBrandColor] = useState(initial.brandColor || "#0f766e");

  const fileRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logoUrl || null);
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
    setSaved(false);
    if (!name.trim()) {
      setError("Business name is required.");
      return;
    }
    startTransition(async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const newLogoUrl = logoFile ? await uploadLogo(user.id) : undefined;

        await saveOrgProfile({
          name: name.trim(),
          kraPin: kraPin || undefined,
          vatRegistered,
          address: address || undefined,
          phone: phone || undefined,
          email: email || undefined,
          invoicePrefix: invoicePrefix || "INV-",
          logoUrl: newLogoUrl ?? undefined,
          brandColor,
        });
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all mt-1";
  const labelCls = "text-[12px] font-medium text-[var(--color-ink-600)]";

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {/* Business identity */}
      <div className="card p-6">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-4">
          Business identity
        </div>
        <div className="flex items-start gap-4 mb-5">
          {/* Logo */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative shrink-0 w-[64px] h-[64px] rounded-xl border-2 border-dashed border-[var(--color-ink-200)] hover:border-[var(--color-accent-500)] flex items-center justify-center transition-colors overflow-hidden bg-[var(--color-ink-50)] group"
            aria-label="Change logo"
          >
            {logoPreview ? (
              <Image src={logoPreview} alt="Logo" fill className="object-cover" />
            ) : (
              <span className="text-[20px] opacity-30 group-hover:opacity-60 transition-opacity">🏢</span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleLogoChange}
          />
          <label className="flex-1 block">
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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </label>
          <label className="block">
            <span className={labelCls}>Brand color (used on PDFs)</span>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-9 w-12 rounded-lg border border-[var(--color-ink-200)] bg-white cursor-pointer p-1"
                aria-label="Brand color"
              />
              <input
                type="text"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-28 rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)]"
                placeholder="#0f766e"
                maxLength={7}
              />
            </div>
          </label>
        </div>
      </div>

      {/* Contact details */}
      <div className="card p-6">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-4">
          Contact details
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <span className={labelCls}>Address (appears on invoices)</span>
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

      {/* Tax & numbering */}
      <div className="card p-6">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-4">
          Tax & invoice numbering
        </div>
        <label className="flex items-start gap-3 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={vatRegistered}
            onChange={(e) => setVatRegistered(e.target.checked)}
            className="accent-[var(--color-accent-500)] mt-0.5"
          />
          <div>
            <div className="text-[13px] font-medium text-[var(--color-ink-900)]">VAT-registered</div>
            <div className="text-[12px] text-[var(--color-ink-400)] mt-0.5">
              Taxable turnover over KES 5M/year — invoices will charge 16% VAT
            </div>
          </div>
        </label>
        <label className="block max-w-[200px]">
          <span className={labelCls}>Invoice prefix</span>
          <input
            type="text"
            value={invoicePrefix}
            onChange={(e) => setInvoicePrefix(e.target.value)}
            className={inputCls}
            placeholder="INV-"
            maxLength={8}
          />
        </label>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-[12.5px] text-[var(--color-bad)]">
          {error}
        </div>
      )}

      {saved && (
        <div className="rounded-lg bg-[var(--color-accent-50)] border border-[var(--color-accent-100)] px-4 py-3 text-[12.5px] text-[var(--color-accent-700)] font-medium">
          ✓ Settings saved
        </div>
      )}

      <button
        type="submit"
        disabled={pending || logoUploading}
        className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-5 py-2.5 transition-colors"
      >
        {logoUploading ? "Uploading logo…" : pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
