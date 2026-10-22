"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { MorphingPillText } from "./MorphingPillText";
import { PromptComposer } from "./spectrumui/blocks/ai-assistants/prompt-composer";
import { ChatEmptyState } from "./spectrumui/blocks/ai-assistants/chat-empty-state";
import type { SuggestedPrompt } from "./spectrumui/blocks/ai-assistants/types";

/** Starter questions shown before the first message. */
const SUGGESTIONS: SuggestedPrompt[] = [
  { id: "brief", label: "Brief me on today" },
  { id: "overdue", label: "Which invoices are overdue?" },
  { id: "cash", label: "What's my cash position?" },
  { id: "bills", label: "Bills due this week" },
  { id: "top", label: "Top customers this month" },
];

const PILL_PHRASES = ["Ask Zeno", "Ask Invoices", "Ask Reports", "Ask Quotes", "Ask Bills", "Ask Payroll", "Ask Expenses"];

interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  pendingAction?: { tool: string; args: any; humanSummary: string } | null;
}

function AssistantText({ text }: { text: string }) {
  return (
    <div className="text-[13.5px] leading-relaxed space-y-2 [&_p]:m-0 [&_ul]:m-0 [&_ul]:pl-4 [&_ul]:list-disc [&_ol]:m-0 [&_ol]:pl-4 [&_ol]:list-decimal [&_li]:my-0.5 [&_strong]:font-semibold [&_h1]:text-[14px] [&_h1]:font-semibold [&_h2]:text-[13.5px] [&_h2]:font-semibold [&_h3]:text-[12px] [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:text-[var(--color-ink-500)] [&_code]:bg-black/5 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_table]:w-full [&_table]:border-collapse [&_table]:my-1 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-[var(--color-ink-500)] [&_th]:pb-1.5 [&_th]:pr-3 [&_th]:border-b [&_th]:border-black/10 [&_td]:py-1.5 [&_td]:pr-3 [&_td]:border-b [&_td]:border-black/5 [&_td]:align-top [&_tr:last-child_td]:border-b-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

export function AiAssistantPill({ initialBriefCount = 0, brandColor }: { initialBriefCount?: number; brandColor?: string | null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badge, setBadge] = useState(initialBriefCount);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // History is fetched once, as early as possible (hovering or focusing the
  // bubble, or opening it) so the panel opens at full size straight away —
  // the suggestions show immediately and past messages slot in if there are any.
  const historyRequested = useRef(false);
  function prefetchHistory() {
    if (historyRequested.current) return;
    historyRequested.current = true;
    fetch("/api/assistant")
      .then((r) => r.json())
      .then((d) => {
        // Don't overwrite a conversation the user already started meanwhile.
        if (Array.isArray(d.messages) && d.messages.length) setMessages((m) => (m.length ? m : d.messages));
      })
      .catch(() => {
        historyRequested.current = false; // let the next open retry
      });
  }

  useEffect(() => {
    if (open) prefetchHistory();
  }, [open]);

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
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
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
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        setMessages((m) => [...m, { role: "assistant", content: "_Stopped._" }]);
      } else {
        setError("Couldn't reach the assistant — check your connection.");
      }
    } finally {
      abortRef.current = null;
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
    <div
      ref={containerRef}
      className="no-print fixed bottom-4 inset-x-0 z-[70] flex flex-col items-center gap-3 px-4 pointer-events-none"
      style={brandColor ? ({ "--color-brand": brandColor } as React.CSSProperties) : undefined}
    >
      {/* Panel — anchored directly above the pill, pill never disappears. */}
      {open && (
        <div
          className="pointer-events-auto w-full max-w-xl max-h-[70vh] flex flex-col rounded-[28px] overflow-hidden border border-black/[0.06] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.25),0_8px_20px_-12px_rgba(0,0,0,0.12)] animate-[zeno-pop_0.18s_ease-out]"
          style={{ background: "rgba(255,255,255,.94)", backdropFilter: "blur(28px) saturate(1.6)" }}
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-5 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[var(--color-ink-900)]">Zeno</span>
              <span className="text-[11.5px] text-[var(--color-ink-400)]">Ask about your books</span>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="grid size-7 place-items-center rounded-lg text-[var(--color-ink-400)] transition-[color,background-color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--color-ink-700)] active:scale-[0.94]"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Conversation */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-5 pt-2 pb-4 space-y-4">
            {messages.length === 0 && !busy && (
              <ChatEmptyState
                className="mx-auto py-4"
                variant="Centered"
                title="What do you want to know?"
                subtitle="Ask about invoices, cash, bills or payroll — or start from one of these."
                prompts={SUGGESTIONS}
                onSelectPrompt={(p) => send(p.prompt ?? p.label)}
              />
            )}
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end animate-[su-msg-in_220ms_cubic-bezier(0.23,1,0.32,1)_both]">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--color-ink-900)] px-3.5 py-2 text-[13.5px] leading-relaxed text-white whitespace-pre-wrap">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex animate-[su-msg-in_220ms_cubic-bezier(0.23,1,0.32,1)_both]">
                  <div className="min-w-0 flex-1 text-[var(--color-ink-900)]">
                    <AssistantText text={m.content} />
                    {m.pendingAction && (
                      <div className="mt-3 rounded-xl border border-black/[0.08] bg-white p-3">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]">Needs your OK</div>
                        <div className="mt-1 text-[13px] text-[var(--color-ink-800)]">{m.pendingAction.humanSummary}</div>
                        <div className="mt-2.5 flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => respondToAction(i, true)}
                            className="flex-1 rounded-lg bg-[var(--color-ink-900)] text-white text-[12.5px] font-medium px-3 py-1.5 transition-transform active:scale-[0.97] disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => respondToAction(i, false)}
                            className="flex-1 rounded-lg border border-black/[0.1] bg-white text-[var(--color-ink-700)] text-[12.5px] font-medium px-3 py-1.5 transition-transform active:scale-[0.97] hover:bg-black/[0.02] disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
            {busy && (
              <div className="flex items-center gap-3" aria-live="polite" aria-label="Zeno is thinking">
                <ThinkingOrb state="searching" size={64} theme="light" />
                <span className="text-[12.5px] text-[var(--color-ink-400)]">Thinking…</span>
              </div>
            )}
            {error && <div className="text-[12.5px] text-[var(--color-bad)] text-center">{error}</div>}
          </div>

          {/* Composer (Spectrum UI Prompt Composer) */}
          <div className="shrink-0 px-3 pb-3">
            <PromptComposer
              autoFocus
              className="max-w-none rounded-[20px] bg-white"
              placeholder="Ask Zeno anything about your books…"
              isGenerating={busy}
              onSend={(text) => send(text)}
              onStop={() => abortRef.current?.abort()}
              maxLength={2000}
            />
            <div className="mt-1.5 text-center text-[10.5px] text-[var(--color-ink-400)]">
              Enter to send · Shift + Enter for a new line · Zeno asks before changing anything
            </div>
          </div>
        </div>
      )}

      {/* Pill — stays put whether the panel is open or closed. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onPointerEnter={prefetchHistory}
        onFocus={prefetchHistory}
        onTouchStart={prefetchHistory}
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
