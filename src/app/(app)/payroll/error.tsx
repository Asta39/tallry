"use client";

export default function PayrollError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-lg mx-auto mt-16 card p-6 text-center">
      <div className="text-[15px] font-semibold mb-1">Something went wrong</div>
      <p className="text-[13px] text-[var(--color-ink-600)] mb-4">
        {error.message || "This action couldn't be completed. Check the details and try again."}
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium px-5 py-2.5"
      >
        Try again
      </button>
    </div>
  );
}
