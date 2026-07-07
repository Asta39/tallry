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
  invoiceTemplate?: string | null;
  quoteTemplate?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
  customDocumentColumnName?: string | null;
  documentFooterText?: string | null;
  dataSegregation: boolean;
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
  const [invoiceTemplate, setInvoiceTemplate] = useState(initial.invoiceTemplate || "default");
  const [quoteTemplate, setQuoteTemplate] = useState(initial.quoteTemplate || "default");
  const [brandColor, setBrandColor] = useState(initial.brandColor || "#0f766e");
  const [customDocumentColumnName, setCustomDocumentColumnName] = useState(initial.customDocumentColumnName || "");
  const [documentFooterText, setDocumentFooterText] = useState(initial.documentFooterText || "");
  const [dataSegregation, setDataSegregation] = useState(initial.dataSegregation);

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
          invoiceTemplate,
          quoteTemplate,
          logoUrl: newLogoUrl ?? undefined,
          brandColor,
          customDocumentColumnName: customDocumentColumnName,
          documentFooterText: documentFooterText,
          dataSegregation,
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

      {/* Security & Access */}
      <div className="card p-6">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-4">
          Security & Access
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={dataSegregation}
            onChange={(e) => setDataSegregation(e.target.checked)}
            className="accent-[var(--color-accent-500)] mt-0.5"
          />
          <div>
            <div className="text-[13px] font-medium text-[var(--color-ink-900)]">Enable Staff Data Segregation</div>
            <div className="text-[12px] text-[var(--color-ink-400)] mt-0.5 max-w-lg">
              When enabled, staff members can only view documents that they have created or have been assigned to. 
              Admins will always be able to see all data.
            </div>
          </div>
        </label>
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

      {/* Document customizations */}
      <div className="card p-6">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-4">
          Document Customizations
        </div>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <span className={labelCls}>Invoice Template</span>
            <div className="text-[12px] text-[var(--color-ink-400)] mb-3">Choose the visual style for your invoices.</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['default', 'classic', 'modern', 'bold'].map(t => (
                <TemplatePreview key={t} type={t} active={invoiceTemplate === t} onClick={() => setInvoiceTemplate(t)} color={brandColor} />
              ))}
            </div>
          </div>
          <div>
            <span className={labelCls}>Quote Template</span>
            <div className="text-[12px] text-[var(--color-ink-400)] mb-3">Choose the visual style for your quotes.</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['default', 'classic', 'modern', 'bold'].map(t => (
                <TemplatePreview key={t} type={t} active={quoteTemplate === t} onClick={() => setQuoteTemplate(t)} color={brandColor} />
              ))}
            </div>
          </div>
          <label className="block mt-4">
            <span className={labelCls}>Item Categories</span>
            <div className="text-[12px] text-[var(--color-ink-400)] mb-3">
              Enable a category column on your quotes and invoices to group related items (e.g., "Design", "Printing").
            </div>
            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={!!customDocumentColumnName}
                onChange={(e) => setCustomDocumentColumnName(e.target.checked ? "Category" : "")}
                className="accent-[var(--color-accent-500)]"
              />
              <span className="text-[13px] font-medium">Enable Categories Column</span>
            </label>
            {!!customDocumentColumnName && (
              <div className="pl-6 border-l-2 border-[var(--color-ink-100)] ml-2">
                <span className={labelCls}>Column Name (optional override)</span>
                <input
                  type="text"
                  value={customDocumentColumnName}
                  onChange={(e) => setCustomDocumentColumnName(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. Category"
                />
              </div>
            )}
          </label>
          <label className="block">
            <span className={labelCls}>Document Footer Text</span>
            <div className="text-[12px] text-[var(--color-ink-400)] mb-1">
              Default terms and conditions or payment info displayed at the bottom of PDFs.
            </div>
            <textarea
              value={documentFooterText}
              onChange={(e) => setDocumentFooterText(e.target.value)}
              className={inputCls + " h-24 resize-none"}
              placeholder="Terms and conditions, Payment Info..."
            />
          </label>
        </div>
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

function TemplatePreview({ type, active, onClick, color }: { type: string, active: boolean, onClick: () => void, color: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full aspect-[1/1.3] rounded-lg border-2 overflow-hidden bg-white hover:border-[var(--color-accent-300)] transition-colors p-2 flex flex-col gap-1.5 ${
        active ? 'border-[var(--color-accent-500)] ring-1 ring-[var(--color-accent-500)]' : 'border-[var(--color-ink-200)]'
      }`}
    >
      {type === 'default' && (
        <>
          <div className="flex justify-between w-full h-4">
            <div className="w-6 h-6 rounded-sm bg-[var(--color-ink-200)]" />
            <div className="flex flex-col items-end gap-0.5">
              <div className="w-8 h-1.5 bg-[var(--color-ink-300)]" />
              <div className="w-12 h-1 bg-[var(--color-ink-100)]" />
            </div>
          </div>
          <div className="w-10 h-1 bg-[var(--color-ink-200)] mt-4" />
          <div className="w-full h-0.5 bg-[var(--color-ink-100)] my-1" />
          <div className="flex justify-between w-full">
            <div className="w-12 h-1 bg-[var(--color-ink-100)]" />
            <div className="w-4 h-1 bg-[var(--color-ink-100)]" />
          </div>
          <div className="flex justify-between w-full">
            <div className="w-8 h-1 bg-[var(--color-ink-100)]" />
            <div className="w-6 h-1 bg-[var(--color-ink-100)]" />
          </div>
          <div className="mt-auto flex justify-end">
            <div className="w-12 h-2" style={{ backgroundColor: color }} />
          </div>
        </>
      )}
      {type === 'classic' && (
        <>
          <div className="w-full flex justify-center mb-1">
            <div className="w-8 h-8 rounded-sm bg-[var(--color-ink-200)]" />
          </div>
          <div className="w-full h-px bg-[var(--color-ink-800)]" />
          <div className="flex justify-between w-full items-center py-1">
            <div className="w-10 h-1.5 bg-[var(--color-ink-300)]" />
            <div className="w-10 h-1.5 bg-[var(--color-ink-300)]" />
          </div>
          <div className="w-full h-px bg-[var(--color-ink-800)] mb-1" />
          <div className="flex justify-between w-full">
            <div className="w-12 h-1 bg-[var(--color-ink-100)]" />
            <div className="w-4 h-1 bg-[var(--color-ink-100)]" />
          </div>
          <div className="mt-auto w-full h-4 bg-[var(--color-ink-50)] border-t border-[var(--color-ink-200)]" />
        </>
      )}
      {type === 'modern' && (
        <>
          <div className="absolute top-0 left-0 right-0 h-6 flex justify-between items-center px-2" style={{ backgroundColor: color }}>
            <div className="w-8 h-1.5 bg-white/80" />
            <div className="w-4 h-4 rounded-sm bg-white/50" />
          </div>
          <div className="w-10 h-1 bg-[var(--color-ink-200)] mt-8" />
          <div className="w-full h-2 mt-2 flex items-center px-1" style={{ backgroundColor: color }}>
             <div className="w-8 h-0.5 bg-white/80" />
          </div>
          <div className="flex justify-between w-full px-1 mt-1">
            <div className="w-12 h-1 bg-[var(--color-ink-100)]" />
            <div className="w-4 h-1 bg-[var(--color-ink-100)]" />
          </div>
          <div className="mt-auto w-full flex justify-end">
             <div className="w-8 h-1.5" style={{ backgroundColor: color }} />
          </div>
        </>
      )}
      {type === 'bold' && (
        <>
          <div className="absolute top-0 left-0 bottom-0 w-2" style={{ backgroundColor: color }} />
          <div className="pl-3 w-full h-full flex flex-col gap-1.5">
            <div className="w-8 h-8 rounded-sm bg-[var(--color-ink-200)]" />
            <div className="w-14 h-2.5 bg-[var(--color-ink-800)] mt-1" />
            <div className="w-10 h-1 bg-[var(--color-ink-200)]" />
            <div className="w-full h-0.5 bg-[var(--color-ink-100)] mt-2" />
            <div className="flex justify-between w-full pr-1 mt-1">
              <div className="w-8 h-1 bg-[var(--color-ink-100)]" />
              <div className="w-4 h-1 bg-[var(--color-ink-100)]" />
            </div>
            <div className="mt-auto pr-1">
               <div className="w-full h-2 bg-[var(--color-ink-100)]" />
            </div>
          </div>
        </>
      )}
      <div className="absolute bottom-1 right-2 text-[9px] font-semibold text-[var(--color-ink-400)] capitalize">{type}</div>
    </button>
  );
}
