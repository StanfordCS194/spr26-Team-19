"use client";

import { useEffect, useRef, useState } from "react";

type TutorChallenge = {
  id: string;
  topic: string;
  prompt: string;
  hint?: string;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

type Props = {
  challenge: TutorChallenge;
  /** Live editor contents so the tutor can see what the learner has tried. */
  learnerCode: string;
};

const QUICK_PROMPTS = [
  "How do I get started?",
  "What's the syntax for this?",
  "I'm stuck — give me a nudge",
  "Explain my error",
];

function RobotFace({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <line x1="16" y1="3" x2="16" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="3" r="2" fill="currentColor" />
      <rect x="6" y="7" width="20" height="16" rx="5" fill="currentColor" />
      <circle cx="12" cy="15" r="2.4" fill="#fff" />
      <circle cx="20" cy="15" r="2.4" fill="#fff" />
      <rect x="13" y="19" width="6" height="1.8" rx="0.9" fill="#fff" />
    </svg>
  );
}

export function CodeTutorChat({ challenge, learnerCode }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fresh conversation whenever a new challenge loads.
  useEffect(() => {
    setMessages([]);
    setInput("");
    abortRef.current?.abort();
  }, [challenge.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;

    // Optimistically append the user turn plus an empty assistant bubble; the
    // empty bubble is what the streamed tokens fill in (and shows the typing dots).
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    // Track the in-flight request so a new challenge / unmount can abort it
    // (see the challenge.id effect) without a stale stream writing into state.
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/code-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          topic: challenge.topic,
          prompt: challenge.prompt,
          hint: challenge.hint,
          learnerCode,
          messages: next,
        }),
      });

      if (!res.ok || !res.body) throw new Error("unavailable");

      // The route streams plain-text deltas; accumulate them and rewrite the
      // last (assistant) message on each chunk so the reply grows live.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = prev.slice();
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
      if (!acc.trim()) {
        setMessages((prev) => {
          const copy = prev.slice();
          copy[copy.length - 1] = {
            role: "assistant",
            content: "Hmm, I didn't catch that — mind asking again?",
          };
          return copy;
        });
      }
    } catch (err) {
      // An aborted request is intentional (challenge changed) — don't surface an
      // error bubble, just bail and let the fresh conversation take over.
      if (controller.signal.aborted) return;
      setMessages((prev) => {
        const copy = prev.slice();
        copy[copy.length - 1] = {
          role: "assistant",
          content: "I couldn't reach my brain just now 🤖 — try again in a sec!",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open the tutor"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 transition hover:scale-105 hover:shadow-xl"
      >
        <span className="absolute inline-flex h-3 w-3 -right-0.5 -top-0.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
        </span>
        <RobotFace className="h-8 w-8" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[70vh] max-h-[560px] w-[92vw] max-w-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center gap-2 bg-gradient-to-br from-sky-500 to-indigo-600 px-4 py-3 text-white">
        <RobotFace className="h-7 w-7 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Bit · your code tutor</p>
          <p className="truncate text-xs text-sky-100">Hints &amp; syntax — never the answer</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Minimize the tutor"
          className="rounded-md p-1 text-sky-100 transition hover:bg-white/20 hover:text-white"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="M5 10h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
        {messages.length === 0 && (
          <div className="rounded-xl bg-white p-3 text-sm text-slate-600 shadow-sm">
            Hi! I&apos;m <span className="font-semibold text-slate-800">Bit</span> 🤖 Ask me how to get
            started, what a function does, or to explain an error. I&apos;ll nudge you — but I won&apos;t
            hand over the answer.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm ${
                m.role === "user"
                  ? "rounded-br-sm bg-sky-600 text-white"
                  : "rounded-bl-sm bg-white text-slate-800"
              }`}
            >
              {m.content || (streaming ? <span className="inline-flex gap-1 align-middle">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
              </span> : "")}
            </div>
          </div>
        ))}
      </div>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 bg-white px-3 py-2">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void send(q)}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex items-center gap-2 border-t border-slate-200 bg-white p-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Bit for a hint…"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
