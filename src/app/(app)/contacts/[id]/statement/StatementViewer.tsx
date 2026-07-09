"use client";

import { StatementLine } from "@/lib/phase-a-actions";
import { useEffect, useState } from "react";

interface Props {
  data: {
    contact: { name: string; address: string | null; kraPin: string | null };
    from: string;
    to: string;
    openingCents: number;
    closingCents: number;
    lines: StatementLine[];
  };
  from: string;
  to: string;
}

export function StatementViewer({ data, from, to }: Props) {
  const [contactId, setContactId] = useState<string>("");

  useEffect(() => {
    // Extract ID from pathname like /contacts/123/statement
    const parts = window.location.pathname.split("/");
    if (parts[2]) {
      setContactId(parts[2]);
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-[var(--color-slate-100)]">
      <div className="flex items-center justify-between p-3 border-b bg-white">
        <div className="text-[13px] font-medium text-[var(--color-ink-600)]">
          {data.contact.name} Statement
        </div>
        <div className="flex gap-2">
          {contactId && (
            <a
              href={`/api/statement/${contactId}?from=${from}&to=${to}`}
              download={`Statement_${data.contact.name.replace(/\\s+/g, '_')}_${from}_${to}.pdf`}
              className="btn btn-primary"
            >
              Download PDF
            </a>
          )}
        </div>
      </div>
      
      {contactId ? (
        <iframe 
          src={`/api/statement/${contactId}?from=${from}&to=${to}`} 
          className="w-full h-full flex-1"
        />
      ) : (
        <div className="p-10 text-center text-[var(--color-ink-400)]">Loading...</div>
      )}
    </div>
  );
}
