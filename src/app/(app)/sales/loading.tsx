/** Generic table-page skeleton — used by invoices, quotes, bills, etc. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-6 w-32 rounded bg-[var(--color-ink-100)]" />
          <div className="h-3 w-48 rounded bg-[var(--color-ink-100)]" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-[var(--color-ink-100)]" />
      </div>
      <div className="card overflow-hidden">
        <div className="h-10 bg-[var(--color-ink-50)] border-b border-[var(--color-ink-100)]" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-12 border-b border-[var(--color-ink-100)] flex items-center px-4 gap-4"
          >
            <div className="h-3 w-20 rounded bg-[var(--color-ink-100)]" />
            <div className="h-3 w-32 rounded bg-[var(--color-ink-100)]" />
            <div className="h-5 w-16 rounded-full bg-[var(--color-ink-100)] ml-auto" />
            <div className="h-3 w-20 rounded bg-[var(--color-ink-100)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
