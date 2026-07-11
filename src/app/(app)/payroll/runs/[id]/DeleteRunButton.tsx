"use client";

import { deletePayrollRunAction } from "../actions";
import { useFormStatus } from "react-dom";

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button 
      type="submit" 
      disabled={pending}
      className="btn btn-outline btn-error btn-sm"
      onClick={(e) => {
        if (!confirm("Are you sure you want to delete this payroll run? All draft payslips will be permanently discarded.")) {
          e.preventDefault();
        }
      }}
    >
      {pending ? "Deleting..." : "Delete Run"}
    </button>
  );
}

export function DeleteRunButton({ runId }: { runId: number }) {
  const deleteAction = deletePayrollRunAction.bind(null, runId);
  return (
    <form action={deleteAction}>
      <DeleteButton />
    </form>
  );
}
