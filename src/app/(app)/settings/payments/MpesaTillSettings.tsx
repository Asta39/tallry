"use client";

import { useState, useTransition } from "react";
import { saveMpesaTillGatewayAction } from "./actions";
import { reconcileMpesaTillAction } from "@/lib/mpesa-till-reconcile";
import { fmtKES } from "@/lib/money";

const GATEWAY_NAMES: Record<string, string> = { mpesa_daraja: "M-Pesa Daraja", kopokopo: "Kopo Kopo" };

export function MpesaTillSettings({
  connectedGateways,
  initialGatewayId,
  preview,
}: {
  connectedGateways: string[];
  initialGatewayId: string | null;
  preview: { hasTill: boolean; tillName: string | null; count: number; inCents: number; outCents: number };
}) {
  const [gatewayId, setGatewayId] = useState(initialGatewayId || "");
  const [savePending, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [reconcilePending, startReconcile] = useTransition();
  const [reconcileResult, setReconcileResult] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nonDarajaOptions = connectedGateways.filter((g) => g !== "mpesa_daraja");

  function handleSave(next: string) {
    setGatewayId(next);
    setSaved(false);
    startSave(async () => {
      await saveMpesaTillGatewayAction(next || null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  function handleReconcile() {
    setError(null);
    setReconcileResult(null);
    startReconcile(async () => {
      const res = await reconcileMpesaTillAction();
      if (res.error) setError(res.error);
      else {
        setReconcileResult({ count: res.count ?? 0 });
        setTimeout(() => window.location.reload(), 1500);
      }
    });
  }

  return (
    <div className="card p-6 space-y-5">
      <div>
        <div className="text-[13px] font-semibold text-[var(--color-ink-900)]">M-Pesa till gateway</div>
        <p className="text-[12px] text-[var(--color-ink-500)] mt-0.5 max-w-lg">
          If M-Pesa money actually settles through a different connected gateway (e.g. Kopo Kopo) rather than
          Daraja directly, pick it here — account pickers will label your M-Pesa till "(via {"{"}gateway{"}"})" so
          it's clear where that money really flows.
        </p>
        <select
          value={gatewayId}
          onChange={(e) => handleSave(e.target.value)}
          disabled={savePending || nonDarajaOptions.length === 0}
          className="mt-3 w-full max-w-sm rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all"
        >
          <option value="">Direct — M-Pesa Daraja (or none)</option>
          {nonDarajaOptions.map((g) => (
            <option key={g} value={g}>{GATEWAY_NAMES[g] || g}</option>
          ))}
        </select>
        {nonDarajaOptions.length === 0 && (
          <div className="text-[11.5px] text-[var(--color-ink-400)] mt-1.5">Connect a non-Daraja gateway above to enable this.</div>
        )}
        {saved && <div className="text-[11.5px] text-[var(--color-good)] mt-1.5">Saved.</div>}
      </div>

      <div className="hairline-t pt-4">
        <div className="text-[13px] font-semibold text-[var(--color-ink-900)]">Fix misrouted M-Pesa transactions</div>
        <p className="text-[12px] text-[var(--color-ink-500)] mt-0.5 max-w-lg">
          Payments received or paid out through a gateway before the M-Pesa till account existed (or while it was
          misconfigured) get stuck in the generic Undeposited Funds account instead of the real till — this moves
          them.
        </p>
        {!preview.hasTill ? (
          <div className="mt-3 text-[12.5px] text-[var(--color-bad)] bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            No M-Pesa till bank account found — add one under Banking first (kind: M-Pesa).
          </div>
        ) : preview.count === 0 ? (
          <div className="mt-3 text-[12.5px] text-[var(--color-good)]">Everything's already routed correctly — nothing to fix.</div>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="text-[12.5px] text-[var(--color-ink-700)]">
              <span className="font-semibold">{preview.count}</span> payment{preview.count === 1 ? "" : "s"} stuck in
              Undeposited Funds — {preview.inCents > 0 && <>{fmtKES(preview.inCents)} received</>}
              {preview.inCents > 0 && preview.outCents > 0 && " · "}
              {preview.outCents > 0 && <>{fmtKES(preview.outCents)} paid out</>}, into <span className="font-medium">{preview.tillName}</span>.
            </div>
            <button
              onClick={handleReconcile}
              disabled={reconcilePending}
              className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors"
            >
              {reconcilePending ? "Reconciling…" : `Move ${preview.count} payment${preview.count === 1 ? "" : "s"} into ${preview.tillName}`}
            </button>
            {reconcileResult && <div className="text-[12.5px] text-[var(--color-good)]">Moved {reconcileResult.count}. Reloading…</div>}
            {error && <div className="text-[12.5px] text-[var(--color-bad)]">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
