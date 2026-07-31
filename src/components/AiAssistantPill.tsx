"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { MorphingPillText } from "./MorphingPillText";

const PILL_PHRASES = ["Ask Zeno", "Ask Invoices", "Ask Reports", "Ask Quotes", "Ask Bills", "Ask Payroll", "Ask Expenses"];

interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  pendingAction?: { tool: string; args: any; humanSummary: string } | null;
}

function AssistantText({ text }: { text: string }) {
  return (
    <div className="text-[13.5px] leading-relaxed space-y-2 [&_p]:m-0 [&_ul]:m-0 [&_ul]:pl-4 [&_ul]:list-disc [&_ol]:m-0 [&_ol]:pl-4 [&_ol]:list-decimal [&_li]:my-0.5 [&_strong]:font-semibold [&_h1]:text-[14px] [&_h1]:font-semibold [&_h2]:text-[13.5px] [&_h2]:font-semibold [&_h3]:text-[12px] [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:text-[var(--color-ink-500)] [&_code]:bg-black/5 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px]">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}

export function AiAssistantPill({ initialBriefCount = 0 }: { initialBriefCount?: number }) {
  const [open, setOpen] = useState(false);
  const [loadedHistory, setLoadedHistory] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badge, setBadge] = useState(initialBriefCount);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !loadedHistory) {
      fetch("/api/assistant")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.messages)) setMessages(d.messages);
          setLoadedHistory(true);
        })
        .catch(() => setLoadedHistory(true));
    }
  }, [open, loadedHistory]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // Siri-style: tapping anywhere outside the pill+panel closes it — no dark
  // scrim dimming the rest of the screen, the app stays fully visible.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setError(null);
    setBadge(0);
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply || (data.pendingAction ? `Proposed: ${data.pendingAction.humanSummary}` : ""), pendingAction: data.pendingAction ?? null },
      ]);
    } catch {
      setError("Couldn't reach the assistant — check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function respondToAction(msgIndex: number, confirm: boolean) {
    const msg = messages[msgIndex];
    if (!msg.pendingAction) return;
    if (!confirm) {
      setMessages((m) => m.map((x, i) => (i === msgIndex ? { ...x, pendingAction: null, content: x.content + " — cancelled." } : x)));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/assistant/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: msg.pendingAction.tool, args: msg.pendingAction.args }),
      });
      const data = await res.json();
      setMessages((m) => {
        const next = m.map((x, i) => (i === msgIndex ? { ...x, pendingAction: null } : x));
        if (!res.ok) {
          setError(data.error || "Action failed");
          return next;
        }
        return [...next, { role: "assistant", content: `Done — ${msg.pendingAction!.humanSummary}.` }];
      });
    } catch {
      setError("Couldn't reach the assistant — check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={containerRef} className="no-print fixed bottom-4 inset-x-0 z-[70] flex flex-col items-center gap-3 px-4 pointer-events-none">
      {/* Panel — anchored directly above the pill, pill never disappears. */}
      {open && (
        <div className="pointer-events-auto w-full max-w-xl max-h-[65vh] flex flex-col rounded-[28px] overflow-hidden border border-black/5 shadow-2xl animate-[zeno-pop_0.18s_ease-out]" style={{ background: "rgba(255,255,255,.92)", backdropFilter: "blur(28px) saturate(1.6)" }}>
          <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            {messages.length === 0 && !busy && (
              <div className="text-[13px] text-[var(--color-ink-400)] text-center mt-6">
                Ask about overdue invoices, cash position, or say &ldquo;brief me&rdquo; for today&rsquo;s to‑dos.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    m.role === "user"
                      ? "bg-[var(--color-accent-500)] text-white text-[13.5px] leading-relaxed"
                      : "bg-black/[0.04] text-[var(--color-ink-900)]"
                  }`}
                >
                  {m.role === "assistant" ? <AssistantText text={m.content} /> : m.content}
                  {m.pendingAction && (
                    <div className="mt-2.5 pt-2.5 border-t border-black/10 flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => respondToAction(i, true)}
                        className="flex-1 rounded-lg bg-[var(--color-good)] text-white text-[12.5px] font-medium px-3 py-1.5 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => respondToAction(i, false)}
                        className="flex-1 rounded-lg bg-white border border-[var(--color-ink-200)] text-[var(--color-ink-700)] text-[12.5px] font-medium px-3 py-1.5 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-2.5 bg-black/[0.04] text-[13px] text-[var(--color-ink-400)]">Thinking…</div>
              </div>
            )}
            {error && <div className="text-[12.5px] text-[var(--color-bad)] text-center">{error}</div>}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="shrink-0 border-t border-black/5 px-4 py-3 flex gap-2"
          >
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Zeno…"
              disabled={busy}
              className="flex-1 rounded-full border border-black/10 bg-white px-4 py-2 text-[13.5px] outline-none focus:border-[var(--color-accent-500)] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-full bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white text-[13px] font-medium px-4 py-2"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Pill — stays put whether the panel is open or closed. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2.5 shadow-lg border border-black/5 transition-transform hover:-translate-y-0.5"
        style={{ background: "rgba(245,245,247,.85)", backdropFilter: "blur(20px) saturate(1.4)" }}
      >
        <span className="text-[15px]">✦</span>
        <MorphingPillText
          texts={PILL_PHRASES}
          enabled={!open}
          frozenText="Zeno"
          className="text-[13px] font-medium text-[var(--color-ink-700)]"
        />
        {!open && badge > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-accent-500)] text-white text-[10.5px] font-semibold flex items-center justify-center">
            {badge}
          </span>
        )}
      </button>
    </div>
  );
}
