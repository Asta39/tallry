"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBudgetAction } from "@/lib/budgets";

export function DeleteBudgetButton({ id }: { id: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this budget and all its lines?")) return;
        startTransition(async () => {
          await deleteBudgetAction(id);
          router.push("/accounting/budgets");
        });
      }}
      className="text-[13px] text-[var(--color-bad)] hover:underline disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete budget"}
    </button>
  );
}
