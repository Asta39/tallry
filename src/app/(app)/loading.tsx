export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Page header skeleton */}
      <div className="space-y-2 mb-6">
        <div className="h-7 w-48 rounded bg-[var(--color-ink-100)]" />
        <div className="h-4 w-64 rounded bg-[var(--color-ink-100)]" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-3">
            <div className="h-3 w-24 rounded bg-[var(--color-ink-100)]" />
            <div className="h-7 w-32 rounded bg-[var(--color-ink-100)]" />
            <div className="h-3 w-20 rounded bg-[var(--color-ink-100)]" />
          </div>
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="card p-6 mt-4 space-y-3">
        <div className="h-4 w-40 rounded bg-[var(--color-ink-100)]" />
        <div className="space-y-2 mt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-[var(--color-ink-100)]" />
          ))}
        </div>
      </div>

      {/* Chart area skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-4">
        <div className="lg:col-span-3 card p-6">
          <div className="h-4 w-40 rounded bg-[var(--color-ink-100)] mb-4" />
          <div className="h-48 rounded bg-[var(--color-ink-100)]" />
        </div>
        <div className="lg:col-span-2 card p-6">
          <div className="h-4 w-24 rounded bg-[var(--color-ink-100)] mb-4" />
          <div className="h-48 rounded bg-[var(--color-ink-100)]" />
        </div>
      </div>
    </div>
  );
}
