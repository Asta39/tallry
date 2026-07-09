import Link from "next/link";
import { fmtKES } from "@/lib/money";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-[13px] text-[var(--color-ink-400)] mt-0.5">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium px-4 py-2 transition-colors"
    >
      {children}
    </Link>
  );
}

const pillStyles: Record<string, string> = {
  draft: "bg-[var(--color-ink-100)] text-[var(--color-ink-600)]",
  open: "bg-blue-50 text-blue-700",
  sent: "bg-blue-50 text-blue-700",
  partial: "bg-amber-50 text-amber-700",
  overdue: "bg-red-50 text-red-700",
  paid: "bg-emerald-50 text-emerald-700",
  accepted: "bg-emerald-50 text-emerald-700",
  declined: "bg-red-50 text-red-700",
  void: "bg-[var(--color-ink-100)] text-[var(--color-ink-400)] line-through",
  won: "bg-emerald-50 text-emerald-700",
  lost: "bg-red-50 text-red-700",
  uncategorized: "bg-amber-50 text-amber-700",
  categorized: "bg-emerald-50 text-emerald-700",
  reconciled: "bg-emerald-50 text-emerald-700",
  written_off: "bg-[var(--color-ink-100)] text-[var(--color-ink-400)]",
};

const pillLabels: Record<string, string> = {
  draft: "Draft",
  open: "Awaiting payment",
  partial: "Partly paid",
  paid: "Paid",
  overdue: "Overdue",
  accepted: "Accepted",
  declined: "Declined",
  void: "Voided",
  written_off: "Written off",
};

export function StatusPill({ status, overdue }: { status: string; overdue?: boolean }) {
  const s = overdue && status === "open" ? "overdue" : status;
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
        pillStyles[s] ?? pillStyles.draft
      }`}
    >
      {pillLabels[s] ?? s}
    </span>
  );
}

export function Money({ cents, className = "" }: { cents: number; className?: string }) {
  return <span className={`tnum ${className}`}>{fmtKES(cents)}</span>;
}

export function StatCard({
  label,
  hint,
  cents,
  emptyHint,
  tone = "neutral",
}: {
  label: string;
  hint?: string;
  cents?: number;
  emptyHint?: string;
  tone?: "neutral" | "good" | "bad" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "text-[var(--color-good)]"
      : tone === "bad"
      ? "text-[var(--color-bad)]"
      : tone === "warn"
      ? "text-[var(--color-warn)]"
      : "";
  return (
    <div className="card px-5 py-4">
      <div className="text-[12.5px] text-[var(--color-ink-600)]">{label}</div>
      {cents !== undefined ? (
        <div className={`money-lg mt-1 ${toneClass}`}>{fmtKES(cents)}</div>
      ) : (
        <div className={`money-lg mt-1 text-[var(--color-ink-300)]`}>---</div>
      )}
      {(hint || emptyHint) && (
        <div className="text-[11.5px] text-[var(--color-ink-400)] mt-0.5">
          {cents === undefined && emptyHint ? emptyHint : hint}
        </div>
      )}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="card px-8 py-14 text-center">
      <div className="text-[15px] font-medium">{title}</div>
      <p className="text-[13px] text-[var(--color-ink-400)] mt-1 max-w-sm mx-auto">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--color-ink-400)] ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  right,
  className = "",
}: {
  children?: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 text-[13px] ${right ? "text-right tnum" : ""} ${className}`}>
      {children}
    </td>
  );
}

export function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px]">{children}</table>
    </div>
  );
}
