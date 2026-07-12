"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/ui";
import { ensurePortalSlugAction } from "./actions";

export function EnableCard() {
  const [busy, setBusy] = useState(false);

  async function enable() {
    setBusy(true);
    try {
      const res = await ensurePortalSlugAction();
      if (res && "error" in res && res.error) { alert("Error: " + res.error); return; }
      window.location.reload();
    } finally { setBusy(false); }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[var(--color-ink-200)] p-6">
      <p className="text-sm text-[var(--color-ink-600)] mb-4">
        Generate your business&apos;s public portal link. Customers scan one printed QR code,
        confirm their M-Pesa number with a one-time SMS code, and can download every
        receipt they&apos;ve ever received from you.
      </p>
      <p className="text-sm text-[var(--color-ink-600)] mb-6">
        Requires SMS receipts to be configured (Settings → SMS Receipts) so verification
        codes can be delivered.
      </p>
      <PrimaryButton onClick={enable} disabled={busy}>
        {busy ? "Creating..." : "Create portal link"}
      </PrimaryButton>
    </div>
  );
}

export function WallQrCard({ orgName, portalUrl, qrDataUrl }: { orgName: string; portalUrl: string; qrDataUrl: string }) {
  function printPoster() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Receipts QR — ${orgName}</title>
      <style>
        body { font-family: -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 95vh; margin: 0; }
        h1 { font-size: 28px; margin: 0 0 6px; } p { color: #555; margin: 4px 0; font-size: 15px; }
        img { width: 320px; height: 320px; margin: 24px 0; }
        .url { font-size: 13px; color: #888; }
      </style></head><body>
      <h1>${orgName}</h1>
      <p>Scan for your payment receipts</p>
      <img src="${qrDataUrl}" alt="QR" />
      <p class="url">${portalUrl}</p>
      <script>window.onload = () => window.print();</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[var(--color-ink-200)] p-6">
      <div className="flex flex-col md:flex-row gap-8 items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="Portal QR" className="w-44 h-44 border border-[var(--color-ink-200)] rounded-lg" />
        <div className="flex-1 space-y-3">
          <div>
            <div className="text-sm font-medium">Your portal link</div>
            <a href={portalUrl} target="_blank" className="text-sm text-blue-600 hover:underline break-all">{portalUrl}</a>
          </div>
          <p className="text-sm text-[var(--color-ink-600)]">
            Print this QR and paste it at your counter. Customers scan it, verify their
            phone with an SMS code, and download any of their receipts — even old ones.
          </p>
          <div className="flex gap-3">
            <PrimaryButton onClick={printPoster}>Print wall poster</PrimaryButton>
            <button
              onClick={() => navigator.clipboard.writeText(portalUrl).then(() => alert("Link copied"))}
              className="px-4 py-2 rounded-lg border border-[var(--color-ink-200)] text-sm font-medium hover:bg-[var(--color-ink-50)]"
            >
              Copy link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
