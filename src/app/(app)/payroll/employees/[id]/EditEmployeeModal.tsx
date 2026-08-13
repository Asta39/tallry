"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { updateEmployeeAction } from "../actions";

const inputCls =
  "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all mt-1";
const labelCls = "text-[12px] font-medium text-[var(--color-ink-600)]";

export function EditEmployeeModal({
  employeeId,
  name,
  basicSalaryCents,
  kraPin,
  nssfNumber,
  shifNumber,
}: {
  employeeId: number;
  name: string;
  basicSalaryCents: number;
  kraPin: string | null;
  nssfNumber: string | null;
  shifNumber: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[var(--color-ink-200)] bg-white hover:bg-[var(--color-ink-50)] text-[13px] font-medium px-4 py-2"
      >
        Edit profile
      </button>

      <Modal open={open} onClose={close} title={`Edit ${name}`} busy={pending} maxWidthClass="max-w-lg">
        <form
          className="p-5 space-y-4"
          action={(formData) => {
            setError(null);
            start(async () => {
              try {
                await updateEmployeeAction(employeeId, formData);
                setOpen(false);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not save changes");
              }
            });
          }}
        >
          <label className="block">
            <span className={labelCls}>Full name</span>
            <input name="name" defaultValue={name} required className={inputCls} />
          </label>

          <label className="block">
            <span className={labelCls}>Basic monthly salary (KSh)</span>
            <input
              name="basicSalary"
              type="number"
              step="0.01"
              min="0"
              defaultValue={(basicSalaryCents / 100).toFixed(2)}
              required
              className={inputCls}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className={labelCls}>KRA PIN</span>
              <input
                name="kraPin"
                defaultValue={kraPin ?? ""}
                className={inputCls + " uppercase font-mono"}
                maxLength={11}
                placeholder="A000000000Z"
              />
            </label>
            <label className="block">
              <span className={labelCls}>NSSF No.</span>
              <input name="nssfNumber" defaultValue={nssfNumber ?? ""} className={inputCls + " font-mono"} />
            </label>
          </div>

          <label className="block">
            <span className={labelCls}>SHIF No.</span>
            <input name="shifNumber" defaultValue={shifNumber ?? ""} className={inputCls + " font-mono"} />
          </label>

          {error && <p className="text-[12.5px] text-[var(--color-bad)]">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
            <button type="button" onClick={close} className="text-[13px] text-[var(--color-ink-500)] hover:underline">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
