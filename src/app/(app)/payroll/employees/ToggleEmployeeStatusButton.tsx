"use client";

import { useTransition } from "react";
import { toggleEmployeeStatusAction } from "./actions";

export function ToggleEmployeeStatusButton({ employeeId, isActive }: { employeeId: number, isActive: boolean }) {
  const [pending, start] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!isActive || confirm("Are you sure you want to suspend this employee? They will not appear in future payroll runs.")) {
          start(async () => {
            await toggleEmployeeStatusAction(employeeId, !isActive);
          });
        }
      }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all cursor-pointer disabled:opacity-50 ${
        isActive
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
          : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-amber-500"}`} />
      {pending ? "Saving..." : isActive ? "Active" : "Suspended"}
    </button>
  );
}
