"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/kit/Button";
import { cx } from "@/components/kit/cx";
import { AiCallError, streamText, type PlanBody } from "@/lib/product/aiClient";
import { proCardClasses, ProSticker } from "./LockIcon";
import type { PaywallReason } from "./Paywall";

/** History kept in the browser and sent with each question. */
const MAX_MESSAGES = 10;
const MAX_CHARS = 1_000;

type Msg = { role: "user" | "assistant"; content: string };

/**
 * "Ask about your numbers" (Pro): a small chat grounded in this plan. The server recomputes the plan and the
 * model only explains it. History lives in this component only. Without Pro the card shows what it does and
 * opens the paywall.
 */
export function AskCard({
  plan,
  suggestions,
  pro,
  onNeedPro,
  className,
}: {
  plan: PlanBody;
  /** Example questions that fit this plan (see lib/product/askSuggestions). */
  suggestions: readonly string[];
  pro: boolean;
  onNeedPro: (reason: PaywallReason) => void;
  className?: string;
}) {
  return (
    <section aria-labelledby="ask-title" className={cx(proCardClasses(!pro), className)}>
      <div className="flex items-center gap-2">
        <h2 id="ask-title" className="font-display text-2xl leading-tight font-extrabold tracking-[-0.03em] text-ink sm:text-[1.75rem]">
          Ask about your numbers
        </h2>
        {!pro && <ProSticker />}
      </div>
      <p className="mt-2 text-base text-ink-2">Questions about this plan, answered from its numbers.</p>
      {pro ? <Chat plan={plan} suggestions={suggestions} onNeedPro={onNeedPro} /> : <Locked suggestions={suggestions} onNeedPro={onNeedPro} />}
    </section>
  );
}

function Locked({ suggestions, onNeedPro }: { suggestions: readonly string[]; onNeedPro: (reason: PaywallReason) => void }) {
  return (
    <div className="mt-5">
      <p className="font-mono text-xs font-bold tracking-[0.08em] text-ink-3 uppercase">For example</p>
      <ul className="mt-3 flex flex-col gap-2">
        {suggestions.map((q) => (
          <li key={q} className="border-l-3 border-ink pl-3 text-base text-ink">
            &ldquo;{q}&rdquo;
          </li>
        ))}
      </ul>
      <Button size="lg" className="mt-6 w-full sm:w-auto" onClick={() => onNeedPro("ask")}>
        Unlock with Pro
      </Button>
    </div>
  );
}

function Chat({ plan, suggestions, onNeedPro }: { plan: PlanBody; suggestions: readonly string[]; onNeedPro: (reason: PaywallReason) => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<Msg[] | null>(null);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages, pending]);

  async function send(history: Msg[]) {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setMessages(history);
    setFailed(null);
    setBusy(true);
    setPending("");
    try {
      const answer = await streamText("/api/ask", { ...plan, messages: history }, setPending, ctrl.signal);
      setMessages([...history, { role: "assistant" as const, content: answer.trim().slice(0, MAX_CHARS) }].slice(-MAX_MESSAGES));
    } catch (err) {
      if (ctrl.signal.aborted) return;
      if (err instanceof AiCallError && err.proRequired) onNeedPro("ask");
      setFailed(history);
    } finally {
      if (!ctrl.signal.aborted) {
        setPending(null);
        setBusy(false);
      }
    }
  }

  function ask(question: string) {
    const q = question.trim().slice(0, MAX_CHARS);
    if (!q || busy) return;
    setDraft("");
    void send([...messages, { role: "user" as const, content: q }].slice(-MAX_MESSAGES));
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    ask(draft);
  }

  return (
    <div className="mt-5 rounded-md border-2 border-ink bg-surface">
      {messages.length === 0 && pending === null && !failed ? (
        <div className="flex flex-wrap gap-2 px-4 pt-4 sm:px-5">
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => ask(q)}
              className="min-h-11 rounded-full border-2 border-ink bg-paper px-4 py-2 text-left text-sm font-medium text-ink hover:bg-sky-soft"
            >
              {q}
            </button>
          ))}
        </div>
      ) : (
        <ol aria-live="polite" className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto px-4 pt-4 sm:px-5">
          {messages.map((m, i) => (
            <Bubble key={i} msg={m} />
          ))}
          {pending !== null &&
            (pending ? (
              <Bubble msg={{ role: "assistant", content: pending }} />
            ) : (
              <li role="status" className="flex items-center gap-1.5 py-2 text-sm text-ink-3">
                <span className="sr-only">Writing an answer…</span>
                {[0, 1, 2].map((i) => (
                  <span key={i} aria-hidden className="size-1.5 rounded-full bg-ink-3 motion-safe:animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </li>
            ))}
          {failed && (
            <li role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-2">
              Couldn&rsquo;t get an answer.
              <Button size="sm" variant="secondary" onClick={() => void send(failed)}>
                Try again
              </Button>
            </li>
          )}
          <li ref={endRef} aria-hidden className="h-0" />
        </ol>
      )}

      <form onSubmit={submit} className="mt-4 flex items-end gap-2 border-t-2 border-ink px-4 py-3 sm:px-5">
        <label htmlFor="ask-input" className="sr-only">
          Your question
        </label>
        <textarea
          id="ask-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              ask(draft);
            }
          }}
          maxLength={MAX_CHARS}
          rows={1}
          placeholder="Ask about your plan"
          className="min-h-11 flex-1 resize-none rounded-md border-3 border-ink bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-ink-3 focus:outline-none focus-visible:shadow-[0_0_0_4px_var(--color-sky),0_0_0_6px_var(--color-ink)]"
        />
        <Button type="submit" disabled={busy || !draft.trim()}>
          Ask
        </Button>
      </form>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const user = msg.role === "user";
  return (
    <li className={cx("flex", user ? "justify-end" : "justify-start")}>
      <p
        className={cx(
          "max-w-[85%] rounded-md border-2 border-ink px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line",
          user ? "bg-ink text-white" : "bg-paper text-ink",
        )}
      >
        <span className="sr-only">{user ? "You: " : "Answer: "}</span>
        {msg.content}
      </p>
    </li>
  );
}
