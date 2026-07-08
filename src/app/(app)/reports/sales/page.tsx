"use client";



export default function SalesReportsEmptyState() {
  return (
    <div className="flex flex-col h-full bg-white border border-[var(--color-ink-200)] rounded-lg overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center gap-4 p-4 border-b border-[var(--color-ink-200)] bg-[var(--color-ink-50)]">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-[var(--color-ink-600)]">Period:</span>
          <div className="w-48">
            <select 
              className="w-full bg-white border border-[var(--color-ink-200)] text-[var(--color-ink-900)] text-[13px] rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]"
              defaultValue="this_month"
            >
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="this_year">This Year</option>
            </select>
          </div>
        </div>
        
        {/* Note: User requested no currency dropdown */}

        <button 
          className="btn-primary py-1.5 px-4 text-[13px] flex items-center gap-1.5 ml-auto"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Generate
        </button>
      </div>

      {/* Main Content (Empty State) */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
        <div className="w-16 h-16 bg-[var(--color-ink-100)] rounded-lg flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-[var(--color-ink-400)]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 19h16v2H4v-2zm2-4h2v4H6v-4zm4-6h2v10h-2V9zm4-4h2v14h-2V5zm4-3h2v17h-2V2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[var(--color-ink-900)] mb-2">Select a Report</h2>
        <p className="text-[14px] text-[var(--color-ink-500)] max-w-sm">
          Choose a report type from the menu on the left.
        </p>
      </div>
    </div>
  );
}
