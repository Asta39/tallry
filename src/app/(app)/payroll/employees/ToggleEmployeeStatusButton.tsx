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
      className={`badge badge-sm cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50 ${isActive ? 'badge-success badge-outline' : 'badge-neutral'}`}
    >
      {pending ? "Saving..." : isActive ? "Active — click to suspend" : "Suspended — click to activate"}
    </button>
  );
}
