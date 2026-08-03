"use client";

import { useRouter } from "next/navigation";
import { useRealtimeTable } from "@/lib/realtime/useRealtimeTable";

/**
 * Invisible watcher mounted on a single document's detail page. DocDetail
 * does too much server-side computation (payments join, tax breakdown,
 * billable-expense rollups, PO/bill lineage) to safely patch client-side —
 * so any change to this exact row (e.g. a gateway webhook posting a bill
 * and flipping it from pending_approval to open) just triggers a server
 * refresh instead of requiring the user to reload the page themselves.
 * Filtered by `id`, not org — the narrowest possible subscription for a
 * single-document view.
 */
export function DocRealtimeRefresh({ docId }: { docId: number }) {
  const router = useRouter();

  useRealtimeTable(
    "documents",
    { column: "id", value: docId },
    {
      onUpdate: () => router.refresh(),
      onDelete: () => router.refresh(),
      onUnreliable: () => router.refresh(),
    }
  );

  return null;
}
