"use client";

import { useState } from "react";
import { runDepreciationAction } from "./actions";

export function DepreciationRunner() {
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM

  async function handleRun() {
    if (!confirm(`Run depreciation for the month ending ${month}?`)) return;
    setLoading(true);
    try {
      // End of the selected month
      const date = new Date(Number(month.split("-")[0]), Number(month.split("-")[1]), 0);
      const dateStr = date.toISOString().slice(0, 10);
      
      const res = await runDepreciationAction(dateStr);
      if (res.error) throw new Error(res.error);
      
      alert(`Depreciation completed for ${res.count} assets.`);
    } catch (e: any) {
      alert("Failed: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2 items-center">
      <input 
        type="month" 
        value={month} 
        onChange={e => setMonth(e.target.value)}
        className="input input-sm input-bordered"
      />
      <button onClick={handleRun} disabled={loading} className="btn btn-sm btn-outline">
        {loading ? "Running..." : "Run Depreciation"}
      </button>
    </div>
  );
}
