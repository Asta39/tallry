"use client";

import { useTransition } from "react";
import { deletePurchaseRequest } from "./actions";

export function DeleteButton({ id, name }: { id: number; name: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete the purchase request from ${name}? This can't be undone.`)) return;
        startTransition(() => {
          deletePurchaseRequest(id);
        });
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
