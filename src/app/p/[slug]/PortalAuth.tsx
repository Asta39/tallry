"use client";

import { useState } from "react";
import { portalRequestOtpAction, portalVerifyOtpAction } from "./actions";

const inputCls = "w-full h-12 px-4 rounded-xl border border-gray-300 focus:border-gray-900 outline-none text-base";

export function PortalAuth({ slug, orgName }: { slug: string; orgName: string }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function requestCode() {
    setBusy(true); setError("");
    try {
      const res = await portalRequestOtpAction(slug, phone);
      if (res && "error" in res && res.error) { setError(res.error); return; }
      setStep("code");
    } finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setError("");
    try {
      const res = await portalVerifyOtpAction(slug, phone, code);
      if (res && "error" in res && res.error) { setError(res.error); return; }
      // cookie set server-side; refresh to show receipts
      window.location.reload();
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      {step === "phone" ? (
        <>
          <label className="block text-sm font-medium text-gray-700">
            Enter the M-Pesa phone number you paid with
          </label>
          <input
            className={inputCls}
            placeholder="07XX XXX XXX"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button
            onClick={requestCode}
            disabled={busy || !phone}
            className="w-full py-3.5 rounded-xl bg-gray-900 text-white font-medium disabled:opacity-50"
          >
            {busy ? "Sending code..." : "Get access code"}
          </button>
        </>
      ) : (
        <>
          <label className="block text-sm font-medium text-gray-700">
            Enter the 4-digit code sent to {phone}
          </label>
          <input
            className={inputCls + " tracking-[0.5em] text-center text-xl"}
            placeholder="••••"
            inputMode="numeric"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <button
            onClick={verify}
            disabled={busy || code.length !== 4}
            className="w-full py-3.5 rounded-xl bg-gray-900 text-white font-medium disabled:opacity-50"
          >
            {busy ? "Checking..." : "View my receipts"}
          </button>
          <button onClick={() => { setStep("phone"); setCode(""); }} className="w-full text-sm text-gray-500">
            Use a different number
          </button>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-[11px] text-gray-400 text-center pt-2">
        Receipts from {orgName}. Your number is only used to find your payments.
      </p>
    </div>
  );
}
