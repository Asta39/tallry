"use client";

import { useState } from "react";

export function WhatsAppInquiry({ orgPhone }: { orgPhone: string | null }) {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (!orgPhone) {
      alert("This business has not configured a phone number.");
      return;
    }
    
    if (!message.trim()) return;

    // Clean phone number: remove non-digits. If starts with 0, replace with 254 (assuming KE).
    let phone = orgPhone.replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "254" + phone.slice(1);
    
    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${phone}?text=${encodedMessage}`;
    window.open(url, "_blank");
    setMessage(""); // clear after send
  };

  return (
    <div className="card p-5 border border-[var(--color-ink-100)] shadow-sm sticky top-24">
      <h3 className="text-[15px] font-bold text-[var(--color-ink-900)] mb-1">Need Help?</h3>
      <p className="text-[13px] text-[var(--color-ink-600)] mb-4">
        Send us a message directly on WhatsApp. We typically reply within a few hours.
      </p>

      <div className="space-y-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can we help you today?"
          rows={4}
          className="w-full px-3 py-2 border border-[var(--color-ink-200)] rounded-lg text-[13.5px] focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none transition-all resize-none"
        />
        <button
          onClick={handleSend}
          disabled={!message.trim()}
          className="w-full py-2.5 bg-[#25D366] hover:bg-[#128C7E] text-white text-[13.5px] font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
          </svg>
          Send Inquiry
        </button>
      </div>
    </div>
  );
}
