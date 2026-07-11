"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStaff, updateStaff, setRolePermission, createCustomRole } from "@/lib/staff-actions";

const inputCls =
  "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] mt-1";
const labelCls = "text-[12px] font-medium text-[var(--color-ink-600)]";

export interface StaffMember {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

export function AddStaffForm({ roles }: { roles: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("staff");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setOk(null);
        start(async () => {
          try {
            await createStaff({ name, email, password, role });
            setOk(`Account created for ${email} — share the password with them privately.`);
            setName(""); setEmail(""); setPassword("");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create account");
          }
        });
      }}
      className="card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
    >
      <label className="block">
        <span className={labelCls}>Full name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Jane Wanjiku" />
      </label>
      <label className="block">
        <span className={labelCls}>Email</span>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="jane@yourco.co.ke" />
      </label>
      <label className="block">
        <span className={labelCls}>Password</span>
        <input required type="text" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="min 8 characters" />
      </label>
      <label className="block">
        <span className={labelCls}>Role</span>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
          {roles.map((r) => (
            <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>
          ))}
        </select>
      </label>
      <button
        disabled={pending}
        className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white text-[13px] font-medium px-4 py-2.5"
      >
        {pending ? "Creating…" : "Create account"}
      </button>
      {error && <div className="col-span-full text-[12.5px] text-[var(--color-bad)]">{error}</div>}
      {ok && <div className="col-span-full text-[12.5px] text-[var(--color-good)] font-medium">✓ {ok}</div>}
    </form>
  );
}

export function StaffList({ staff, roles }: { staff: StaffMember[]; roles: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (staff.length === 0) {
    return (
      <div className="card px-6 py-8 text-center text-[13px] text-[var(--color-ink-400)]">
        No staff yet — create the first account above.
      </div>
    );
  }
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px]">
        <thead className="hairline-b">
          <tr className="text-[11.5px] uppercase tracking-wide text-[var(--color-ink-400)]">
            <th className="text-left px-4 py-2.5 font-semibold">Name</th>
            <th className="text-left px-4 py-2.5 font-semibold">Email</th>
            <th className="text-left px-4 py-2.5 font-semibold">Role</th>
            <th className="text-left px-4 py-2.5 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((m) => (
            <tr key={m.id} className="hairline-t">
              <td className="px-4 py-3 text-[13px] font-medium">{m.name || "—"}</td>
              <td className="px-4 py-3 text-[13px]">{m.email}</td>
              <td className="px-4 py-3">
                <select
                  disabled={pending}
                  value={m.role}
                  onChange={(e) =>
                    start(async () => {
                      await updateStaff(m.id, { role: e.target.value });
                      router.refresh();
                    })
                  }
                  className="rounded-md border border-[var(--color-ink-200)] px-2 py-1 text-[12.5px] bg-white"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <button
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await updateStaff(m.id, { active: !m.active });
                      router.refresh();
                    })
                  }
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    m.active ? "bg-emerald-50 text-emerald-700" : "bg-[var(--color-ink-100)] text-[var(--color-ink-400)]"
                  }`}
                >
                  {m.active ? "Active — click to disable" : "Disabled — click to enable"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PermissionMatrix({
  roles,
  modules,
  matrix,
}: {
  roles: string[];
  modules: { key: string; label: string }[];
  matrix: Record<string, Record<string, boolean>>; // role → permKey → allowed
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [local, setLocal] = useState(matrix);

  function toggle(role: string, key: string) {
    const next = !local[role][key];
    setLocal((m) => ({ ...m, [role]: { ...m[role], [key]: next } }));
    start(async () => {
      try {
        await setRolePermission(role, key, next);
        router.refresh();
      } catch {
        setLocal((m) => ({ ...m, [role]: { ...m[role], [key]: !next } }));
      }
    });
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead className="hairline-b">
          <tr className="text-[11.5px] uppercase tracking-wide text-[var(--color-ink-400)]">
            <th className="text-left px-4 py-2.5 font-semibold">Module</th>
            {roles.map((r) => (
              <th key={r} className="text-center px-3 py-2.5 font-semibold">{r}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((mod) => (
            <tr key={mod.key} className="hairline-t">
              <td className="px-4 py-2.5 text-[13px]">{mod.label}</td>
              {roles.map((r) => (
                <td key={r} className="text-center px-3 py-2.5">
                  <button
                    disabled={pending}
                    onClick={() => toggle(r, mod.key)}
                    aria-label={`${r} · ${mod.label}`}
                    className={`inline-block w-9 h-5 rounded-full relative transition-colors ${
                      local[r]?.[mod.key] ? "bg-[var(--color-accent-500)]" : "bg-[var(--color-ink-200)]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                        local[r]?.[mod.key] ? "left-[18px]" : "left-0.5"
                      }`}
                    ></span>
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CreateRoleForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          try {
            await createCustomRole(name);
            setName("");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create role");
          }
        });
      }}
      className="flex items-center gap-2"
    >
      {error && <span className="text-[12px] text-[var(--color-bad)] mr-2">{error}</span>}
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[12.5px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] w-48"
        placeholder="Custom role name"
      />
      <button
        disabled={pending}
        className="rounded-lg bg-[var(--color-ink-900)] hover:bg-black disabled:opacity-50 text-white text-[12.5px] font-medium px-3 py-1.5"
      >
        {pending ? "Adding…" : "Add Role"}
      </button>
    </form>
  );
}
