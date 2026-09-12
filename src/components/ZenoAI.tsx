"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { PromptInput } from "@/components/ui/ai-chat-input";

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  exiting?: boolean;
};

/** Hard cap on bubbles kept on screen — the chat area has room for roughly
 *  this many before it turns into an endless scroll of old small-talk.
 *  Older bubbles beyond this are evaporated (see EVAPORATE_MS) rather than
 *  just snipped off, so long conversations still feel alive instead of
 *  abruptly truncated. */
const MAX_VISIBLE_MESSAGES = 4;
const EVAPORATE_MS = 550;

/** Renders **bold** as real bold and turns " - **X** – ..." inline bullet
 *  runs into an actual bulleted list. The system prompt asks the model for
 *  plain prose with no markdown, but this is defense-in-depth for whenever
 *  it ignores that — raw asterisks/dashes never reach the screen either way. */
function formatInline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(/\*\*([^*]+)\*\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={`${keyPrefix}-${i}`}>{part}</strong> : part
  );
}

function renderAssistantContent(content: string): React.ReactNode {
  const segments = content
    .split(/\s-\s(?=\*\*)/g)
    .map((s) => s.replace(/^-\s*/, "").trim())
    .filter(Boolean);

  if (segments.length <= 1) {
    const lines = content.split(/\n+/).filter(Boolean);
    return lines.map((line, i) => (
      <p key={i} className={i > 0 ? "mt-1.5" : undefined}>
        {formatInline(line, `l${i}`)}
      </p>
    ));
  }

  const [intro, ...items] = segments;
  return (
    <>
      {intro && <p>{formatInline(intro, "intro")}</p>}
      <ul className="mt-1.5 list-disc space-y-1 pl-4">
        {items.map((item, i) => (
          <li key={i}>{formatInline(item, `i${i}`)}</li>
        ))}
      </ul>
    </>
  );
}

export function ZenoAI() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const nextId = useRef(0);
  const threadRef = useRef<HTMLDivElement>(null);
  const scheduledForRemoval = useRef<Set<number>>(new Set());

  function pushMessage(role: ChatMessage["role"], content: string) {
    const id = nextId.current++;
    setMessages((prev) => {
      const next = [...prev, { id, role, content }];
      // Mark the oldest bubble(s) beyond the visible cap as exiting instead
      // of deleting them outright — the evaporate animation plays first,
      // then the scheduling effect below removes them once it finishes.
      const overflow = next.length - MAX_VISIBLE_MESSAGES;
      if (overflow > 0) {
        let marked = 0;
        for (let i = 0; i < next.length && marked < overflow; i++) {
          if (!next[i].exiting) {
            next[i] = { ...next[i], exiting: true };
            marked++;
          }
        }
      }
      return next;
    });
    return id;
  }

  // Evaporating bubbles get removed from state once their animation has had
  // time to finish — a ref-backed set guards against scheduling the same
  // removal twice across re-renders.
  useEffect(() => {
    for (const m of messages) {
      if (m.exiting && !scheduledForRemoval.current.has(m.id)) {
        scheduledForRemoval.current.add(m.id);
        setTimeout(() => {
          setMessages((prev) => prev.filter((x) => x.id !== m.id));
          scheduledForRemoval.current.delete(m.id);
        }, EVAPORATE_MS);
      }
    }
  }, [messages]);

  // Keep the thread scrolled to the newest message — this is also what
  // makes older bubbles visually drift up toward the top boundary as the
  // conversation grows, right before they evaporate.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async (
    message: string,
    meta: { model: string; effort: string }
  ) => {
    console.log("Message Submitted:", message);
    console.log("Submission Meta:", meta);

    const history = messages.filter((m) => !m.exiting).map((m) => ({ role: m.role, content: m.content }));
    pushMessage("user", message);
    setLoading(true);

    try {
      const res = await fetch("/api/marketing-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data = await res.json();
      const reply = typeof data?.reply === "string" ? data.reply : "Something went wrong — please try again.";
      pushMessage("assistant", reply);
    } catch {
      pushMessage("assistant", "Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden gap-6 py-16"
      style={{
        backgroundImage:
          "radial-gradient(125% 125% at 50% 101%, rgba(245,87,2,1) 10.5%, rgba(245,120,2,1) 16%, rgba(245,140,2,1) 17.5%, rgba(245,170,100,1) 25%, rgba(238,174,202,1) 40%, rgba(202,179,214,1) 65%, rgba(148,201,233,1) 100%)",
      }}
    >
      <style>{`
        @keyframes zeno-ai-evaporate {
          0%   { opacity: 1; filter: blur(0px); transform: translateY(0) scale(1); }
          55%  { opacity: .45; filter: blur(3px); transform: translateY(-10px) scale(.97); }
          100% { opacity: 0; filter: blur(8px); transform: translateY(-22px) scale(.9); }
        }
        [data-zeno-ai-bubble][data-exiting="true"] {
          animation: zeno-ai-evaporate ${EVAPORATE_MS}ms ease forwards;
          pointer-events: none;
        }
        [data-zeno-ai-bubble] {
          font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
        }
      `}</style>
      {/* Softens the hard cut from the white showcase section above into
          this gradient section — purely decorative, unrelated to the
          (intentionally invisible) message-eviction boundary below. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-32 bg-gradient-to-b from-[#fefefe] to-transparent" />
      <h2 className="relative z-10 px-4 text-center text-2xl font-extrabold text-white sm:text-3xl" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
        Any question about Zeno? Just ask.
      </h2>
      {messages.length > 0 && (
        <div className="relative z-10 w-full max-w-lg px-4">
          {/* No visible marker for the eviction boundary — it's purely a
              count check (MAX_VISIBLE_MESSAGES) in pushMessage, so bubbles
              simply evaporate once the cap is exceeded rather than at some
              drawn line. With the cap this low the thread never needs to
              scroll, so no overflow/scrollbar either. */}
          <div ref={threadRef} className="flex flex-col gap-2 overflow-hidden py-2">
            {messages.map((m) => (
              <div
                key={m.id}
                data-zeno-ai-bubble
                data-exiting={m.exiting ? "true" : "false"}
                className={
                  m.role === "user"
                    ? "self-end max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300"
                    : "self-start max-w-[85%] rounded-2xl rounded-bl-sm bg-card px-4 py-2.5 text-sm text-foreground shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300"
                }
              >
                {m.role === "assistant" ? renderAssistantContent(m.content) : m.content}
              </div>
            ))}
            {loading && (
              <div className="self-start flex gap-1 rounded-2xl rounded-bl-sm bg-card px-4 py-3 shadow-sm animate-in fade-in duration-300">
                <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
                <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
                <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-4 w-full max-w-lg flex justify-center z-10">
        <PromptInput onSubmit={handleSendMessage} placeholder="Ask anything about Zeno..." />
      </div>
    </div>
  );
}
